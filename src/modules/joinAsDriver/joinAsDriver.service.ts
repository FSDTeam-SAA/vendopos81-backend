import dotenv from 'dotenv';
const config = dotenv.config() as { parsed: { bcryptSaltRounds: string } };
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary";
import sendEmail from "../../utils/sendEmail";
import sendTemplateMail from "../../utils/sendTamplateMail";
import { User } from "../user/user.model";
import { IDriverQuery, IJoinAsDriver } from "./joinAsDriver.interface";
import JoinAsDriver from "./joinAsDriver.model";
import mongoose from "mongoose";


const joinAsDriver = async (
  email: string,
  payload: IJoinAsDriver,
  files: any
) => {
  const user = await User.isUserExistByEmail(email);
  if (!user) throw new AppError("Account does not exist", StatusCodes.NOT_FOUND);

  // 1. Role Conflict Validation
  if (user.role === "driver") throw new AppError("You are already a driver", StatusCodes.BAD_REQUEST);
  if (user.role === "supplier") {
    throw new AppError("Supplier accounts cannot register as drivers. Use a different email.", StatusCodes.FORBIDDEN);
  }

  // 2. Check for existing pending/approved applications
  const existingRequest = await JoinAsDriver.findOne({ userId: user._id });
  if (existingRequest && (existingRequest.status === "pending" || existingRequest.status === "approved")) {
    throw new AppError(`Request already ${existingRequest.status}`, StatusCodes.BAD_REQUEST);
  }

  // 3. File Processing
  const documentFiles = files?.documents || [];
  if (documentFiles.length === 0) throw new AppError("Documents required", StatusCodes.BAD_REQUEST);

  const uploadedImages = [];
  for (const file of documentFiles) {
    const uploaded = await uploadToCloudinary(file.path, "drivers/documents");
    uploadedImages.push({
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    });
  }

  // 4. Create Driver Profile linked to existing User
  return await JoinAsDriver.create({
    ...payload,
    documentUrl: uploadedImages,
    userId: user._id,
    status: "pending",
  });
};


const getMyDriverInfo = async (email: string) => {
  const user = await User.isUserExistByEmail(email);
  return await JoinAsDriver.findOne({ userId: user?._id }).populate(
    "userId",
    "firstName lastName email image"
  );
};

const getAllDrivers = async (query: IDriverQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (query.status) filter.status = query.status;

  const search = query.search
    ? {
      $or: [
        { firstName: { $regex: query.search, $options: "i" } },
        { email: { $regex: query.search, $options: "i" } },
      ],
    }
    : {};

  const drivers = await JoinAsDriver.find({ ...filter, ...search })
    .populate("userId", "firstName lastName email image")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await JoinAsDriver.countDocuments({ ...filter, ...search });
  return {
    data: drivers,
    meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
  };
};


const updateDriverStatus = async (id: string, status: "approved" | "rejected") => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const driverApplication = await JoinAsDriver.findById(id);
    if (!driverApplication) {
      throw new AppError("Driver application not found", StatusCodes.NOT_FOUND);
    }

    // 1. Update the Application Status
    const updatedApplication = await JoinAsDriver.findByIdAndUpdate(
      id,
      { status },
      { new: true, session }
    );

    // 2. If Approved: Promote the User Role
    if (status === "approved") {
      await User.findByIdAndUpdate(
        driverApplication.userId,
        { role: "driver" },
        { session }
      );

      // 3. Send Success Email
      await sendEmail({
        to: driverApplication.email,
        subject: "Congratulations! Your Driver Application is Approved",
        html: sendTemplateMail({
          type: "success",
          email: driverApplication.email,
          subject: "Application Approved",
          message: `Hello ${driverApplication.firstName}, your application has been approved. You can now log in and access the Driver Dashboard.`,
        }),
      });
    }

    // 4. If Rejected: Optional notification
    else if (status === "rejected") {
      await sendEmail({
        to: driverApplication.email,
        subject: "Update on your Driver Application",
        html: `<h1>Application Update</h1><p>Sorry, your application was not approved at this time.</p>`,
      });
    }

    await session.commitTransaction();
    return updatedApplication;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


const suspendDriver = async (id: string, suspensionDays?: number) => {
  const driver = await JoinAsDriver.findById(id);
  if (!driver) throw new AppError("Driver not found", StatusCodes.NOT_FOUND);

  const isCurrentlySuspended = driver.isSuspended;
  let suspendedUntil = null;

  if (!isCurrentlySuspended && suspensionDays) {
    suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + suspensionDays);
  }

  return await JoinAsDriver.findByIdAndUpdate(
    id,
    { isSuspended: !isCurrentlySuspended, suspendedUntil },
    { new: true }
  );
};

const getSingleDriver = async (id: string) => {
  const result = await JoinAsDriver.findById(id).populate(
    "userId",
    "firstName lastName email image"
  );
  if (!result) {
    throw new AppError("Driver application not found", StatusCodes.NOT_FOUND);
  }
  return result;
};

const deleteDriver = async (id: string) => {
  const driver = await JoinAsDriver.findById(id);
  if (!driver) {
    throw new AppError("Driver application not found", StatusCodes.NOT_FOUND);
  }

  await User.findByIdAndDelete(driver.userId, {
    role: "customer",
  });

  if (driver.documentUrl?.length) {
    for (const doc of driver.documentUrl) {
      try {
        await deleteFromCloudinary(doc.public_id);
      } catch (error) {
        console.log("Cloudinary delete failed:", error)
      }
    }
  }

  await JoinAsDriver.findByIdAndDelete(id);

  return { success: true, message: "Driver application deleted successfully" };

}

// When a driver is approved by Admin
const approveDriver = async (driverId: string) => {
  const result = await JoinAsDriver.findByIdAndUpdate(
    driverId,
    { status: "approved" },
    { new: true }
  );

  if (!result) throw new AppError("Driver application not found", 404);

  // Optional: Send "Welcome to the Team" Email
  await sendEmail({
    to: result.email,
    subject: "Application Approved!",
    html: "<h1>Congratulations!</h1><p>You can now start accepting deliveries.</p>"
  });

  return result;
};

const registerDriverUnified = async (payload: any, files: any, currentUser?: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  // Track uploaded images for manual rollback if transaction fails
  const uploadedImages: { public_id: string; url: string }[] = [];

  try {
    let userId: string;

    if (currentUser) {
      // --- SCENARIO 1: LOGGED IN ---
      const user = await User.isUserExistByEmail(currentUser.email);
      if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);
      if (user.role === "driver") throw new AppError("Already a driver", StatusCodes.BAD_REQUEST);
      if (user.role === "supplier") throw new AppError("Suppliers cannot be drivers", StatusCodes.FORBIDDEN);

      const existingApp = await JoinAsDriver.findOne({ userId: user._id });
      if (existingApp) throw new AppError(`Application already exists: ${existingApp.status}`, StatusCodes.BAD_REQUEST);

      userId = user._id;
    } else {
      // --- SCENARIO 2: GUEST --- 
      if (!payload.password) throw new AppError("Password is required", StatusCodes.BAD_REQUEST);

      const isExist = await User.findOne({ $or: [{ email: payload.email }, { phone: payload.phone }] });
      if (isExist) throw new AppError("Email or Phone already exists", StatusCodes.CONFLICT);

      // JUST PASS THE PLAIN PASSWORD - The Schema pre-save hook will hash it automatically 
      const [newUser] = await User.create([{
        ...payload,
        role: "customer",
        isVerified: false
      }], { session });

      userId = newUser._id;
    }

    // --- FILE UPLOAD --- 
    const documentFiles = files?.documents || [];
    if (documentFiles.length === 0) throw new AppError("Documents are required", StatusCodes.BAD_REQUEST);

    for (const file of documentFiles) {
      const uploaded = await uploadToCloudinary(file.path, "drivers/documents");
      uploadedImages.push({
        url: uploaded.secure_url,
        public_id: uploaded.public_id
      });
    }

    // --- CREATE DRIVER PROFILE ---
    const [newDriver] = await JoinAsDriver.create([{
      ...payload,
      userId,
      documentUrl: uploadedImages,
      status: "pending"
    }], { session });

    await session.commitTransaction();
    return { userId, driverId: newDriver._id };

  } catch (error) {
    await session.abortTransaction();

    // ROLLBACK: Cleanup Cloudinary if DB fails
    if (uploadedImages.length > 0) {
      for (const img of uploadedImages) {
        await deleteFromCloudinary(img.public_id);
      }
    }

    throw error;
  } finally {
    session.endSession();
  }
};

export const joinAsDriverService = {
  joinAsDriver,
  getMyDriverInfo,
  getAllDrivers,
  updateDriverStatus,
  suspendDriver,
  getSingleDriver,
  deleteDriver,
  approveDriver,
  registerDriverUnified
};
