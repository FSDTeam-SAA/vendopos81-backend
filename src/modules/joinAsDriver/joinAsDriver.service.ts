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
  if (!user)
    throw new AppError("Account does not exist", StatusCodes.NOT_FOUND);

  if (user.role === "driver") {
    throw new AppError("You are already a driver", StatusCodes.BAD_REQUEST);
  }

  const existingRequest = await JoinAsDriver.findOne({ userId: user._id });
  if (
    existingRequest &&
    (existingRequest.status === "pending" ||
      existingRequest.status === "approved")
  ) {
    throw new AppError(
      `Request already ${existingRequest.status}`,
      StatusCodes.BAD_REQUEST
    );
  }

  //  Extract Files from the correct field
  // When using upload.fields, req.files is an object.
  const documentFiles = files && "documents" in files ? files.documents : [];

  // Validation Check
  if (!documentFiles || documentFiles.length === 0) {
    throw new AppError("Documents required", StatusCodes.BAD_REQUEST);
  }

  // Upload to Cloudinary
  const uploadedImages = [];
  for (const file of documentFiles) {
    // Note: ensure your uploadToCloudinary utility is imported correctly
    const uploaded = await uploadToCloudinary(file.path, "drivers/documents");
    uploadedImages.push({
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    });
  }

  //  Create Driver Record
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

const updateDriverStatus = async (id: string, status: string) => {
  const driver = await JoinAsDriver.findById(id);
  if (!driver) throw new AppError("Driver not found", StatusCodes.NOT_FOUND);

  await JoinAsDriver.findByIdAndUpdate(id, { status }, { new: true });

  if (status === "approved") {
    await User.findByIdAndUpdate(driver.userId, { role: "driver" });
    await sendEmail({
      to: driver.email,
      subject: "Driver Account Approved",
      html: sendTemplateMail({
        type: "success",
        email: driver.email,
        subject: "Approved",
        message: "You are now an official driver!",
      }),
    });
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

  if(driver.documentUrl?.length) {
    for(const doc of driver.documentUrl){
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

const directRegisterDriver = async (payload: any, files: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Check if Email or Phone already exists to prevent Duplicate Key errors
    const isUserExist = await User.findOne({ email: payload.email });
    if (isUserExist) {
      throw new AppError("Email already registered. Please login.", StatusCodes.CONFLICT);
    }

    const isPhoneExist = await JoinAsDriver.findOne({ phone: payload.phone });
    if (isPhoneExist) {
      throw new AppError("Phone number already in use by another driver.", StatusCodes.CONFLICT);
    }

    // 2. Create the User Account
    const userData = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      role: "customer", // Role stays customer until Admin approves
      isVerified: false, 
    };

    const newUser = await User.create([userData], { session });

    // 3. Handle File Uploads to Cloudinary
    const documentFiles = files?.documents || [];
    if (documentFiles.length === 0) {
      throw new AppError("Driver documents are required", StatusCodes.BAD_REQUEST);
    }

    const uploadedImages = [];
    for (const file of documentFiles) {
      const uploaded = await uploadToCloudinary(file.path, "drivers/documents");
      uploadedImages.push({
        url: uploaded.secure_url, // Corrected key from utility
        public_id: uploaded.public_id,
      });
    }

    // 4. Create the Driver Profile
    const driverData = {
      ...payload,
      userId: newUser[0]._id, // Use the ID from the created user
      documentUrl: uploadedImages,
      status: "pending",
    };

    const newDriver = await JoinAsDriver.create([driverData], { session });

    await session.commitTransaction();
    session.endSession();

    return { user: newUser[0], driver: newDriver[0] };
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw error;
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
  directRegisterDriver
};
