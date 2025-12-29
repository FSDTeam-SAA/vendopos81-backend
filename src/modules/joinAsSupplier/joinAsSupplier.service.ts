import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import config from "../../config";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import { uploadToCloudinary } from "../../utils/cloudinary";
import sendEmail from "../../utils/sendEmail";
import { createToken } from "../../utils/tokenGenerate";
import verificationCodeTemplate from "../../utils/verificationCodeTemplate";
import { IUser } from "../user/user.interface";
import { User } from "../user/user.model";
import { IJoinAsSupplier, IQuery } from "./joinAsSupplier.interface";
import JoinAsSupplier from "./joinAsSupplier.model";


const joinAsSupplier = async (
  payload: IJoinAsSupplier,
  documents: Express.Multer.File[],
  logoFile?: Express.Multer.File,
  currentUser?: IUser
) => {
  if (!documents || documents.length === 0) {
    throw new AppError(
      "You must upload at least one document",
      StatusCodes.BAD_REQUEST
    );
  }

  /** ===============================
   * Upload documents
   ===============================*/
  const uploadedDocuments: { url: string; public_id: string }[] = [];

  for (const file of documents) {
    const uploaded = await uploadToCloudinary(file.path, "supplier-documents");
    uploadedDocuments.push({
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    });
  }

  /** ===============================
   * Upload logo (optional)
   ===============================*/
  let logo: { url: string; public_id: string } | null = null;

  if (logoFile) {
    const uploadedLogo = await uploadToCloudinary(
      logoFile.path,
      "supplier-logos"
    );

    logo = {
      url: uploadedLogo.secure_url,
      public_id: uploadedLogo.public_id,
    };
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    let user: IUser;
    let accessToken: string | null = null;
    let tempPassword: string | null = null;

    /** ===============================
     * CASE 1️⃣ Logged-in user
     ===============================*/
    if (currentUser) {
      const dbUser = await User.findById(currentUser.userId).session(session);

      if (!dbUser) {
        throw new AppError("User not found", StatusCodes.NOT_FOUND);
      }

      const existingRequest = await JoinAsSupplier.findOne({
        userId: dbUser._id,
        status: { $in: ["pending", "approved"] },
      }).session(session);

      if (existingRequest) {
        throw new AppError(
          existingRequest.status === "approved"
            ? "You are already a supplier"
            : "Your supplier request is under review",
          StatusCodes.BAD_REQUEST
        );
      }

      user = dbUser;
    } else {

    /** ===============================
     * CASE 2️⃣ Guest user
     ===============================*/
      const existingUser = await User.findOne({
        $or: [{ email: payload.email }, { phone: payload.phone }],
      }).session(session);

      if (existingUser) {
        throw new AppError(
          "Account already exists. Please login to continue.",
          StatusCodes.BAD_REQUEST
        );
      }

      const password = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const hashedOtp = await bcrypt.hash(otp, 10);
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

      const createdUsers = await User.create(
        [
          {
            email: payload.email,
            phone: payload.phone,
            password,
            role: "supplier",
            isVerified: false,
            otp: hashedOtp,
            otpExpires,
          },
        ],
        { session }
      );

      user = createdUsers[0];
      tempPassword = password;

      accessToken = createToken(
        { userId: user._id, email: user.email, role: user.role },
        config.JWT_SECRET as string,
        config.JWT_EXPIRES_IN as string
      );
    }

    /** ===============================
     * Final safety check
     ===============================*/
    const alreadySupplier = await JoinAsSupplier.findOne({
      userId: user._id,
      status: { $in: ["pending", "approved"] },
    }).session(session);

    if (alreadySupplier) {
      throw new AppError(
        "Supplier request already exists",
        StatusCodes.BAD_REQUEST
      );
    }

    /** ===============================
     * Create supplier request
     ===============================*/
    const shopSlug = generateShopSlug(payload.shopName);

    const supplierRequest = await JoinAsSupplier.create(
      [
        {
          ...payload,
          userId: user._id,
          shopSlug,
          documentUrl: uploadedDocuments,
          logo,
          status: "pending",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    await session.endSession();

    /** ===============================
     * Send OTP after commit
     ===============================*/
    if (tempPassword) {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: verificationCodeTemplate("OTP sent"),
      });
    }

    return {
      user,
      supplierRequest: supplierRequest[0],
      tempPassword,
      accessToken,
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    throw new AppError(
      (error as Error).message || "Failed to join as supplier",
      StatusCodes.BAD_REQUEST
    );
  }
};

const getMySupplierInfo = async (email: string) => {
  const user = await User.isUserExistByEmail(email);
  if (!user) {
    throw new Error("Your account does not exist");
  }

  const isExistingSupplier = await JoinAsSupplier.findOne({ userId: user._id });
  if (!isExistingSupplier) {
    throw new Error("You have not applied to be a supplier");
  }

  const supplierInfo = await JoinAsSupplier.findOne({
    userId: user._id,
  }).populate("userId", "firstName lastName email phoneNumber");

  return supplierInfo;
};

const getAllSuppliers = async (query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};

  // ✅ Status filter
  if (query.status) {
    filter.status = query.status;
  }

  // ✅ CreatedAt filter for 1day and 7day
  if (query.sort === "1day") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    filter.createdAt = { $gte: yesterday };
  }

  if (query.sort === "7day") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    filter.createdAt = { $gte: sevenDaysAgo };
  }

  // ✅ Search by shopName, user firstName, lastName
  const search = query.search
    ? {
        $or: [
          { shopName: { $regex: query.search, $options: "i" } },
          { "userId.firstName": { $regex: query.search, $options: "i" } },
          { "userId.lastName": { $regex: query.search, $options: "i" } },
        ],
      }
    : {};

  const combinedFilter = { ...filter, ...search };

  // ✅ Sorting
  let sortOption: any = { createdAt: -1 }; // default newest first
  if (query.sort === "atoz") {
    sortOption = { shopName: 1 };
  }

  // ✅ Query
  const suppliers = await JoinAsSupplier.find(combinedFilter)
    .populate("userId", "firstName lastName email phone image")
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const total = await JoinAsSupplier.countDocuments(combinedFilter);

  return {
    data: suppliers,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const getSingleSupplier = async (id: string) => {
  const supplier = await JoinAsSupplier.findById(id).populate(
    "userId",
    "firstName lastName email phone image"
  );
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  return supplier;
};

const updateSupplierStatus = async (id: string, status: string) => {
  // const supplier = await JoinAsSupplier.findById(id);
  // if (!supplier) {
  //   throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  // }
  // const validStatuses = ["pending", "approved", "rejected"];
  // if (!validStatuses.includes(status)) {
  //   throw new AppError("Invalid status value", StatusCodes.BAD_REQUEST);
  // }
  // await JoinAsSupplier.findByIdAndUpdate(id, { status }, { new: true });
  // // ✅ Email content
  // if (status === "approved") {
  //   await User.findByIdAndUpdate(supplier.userId, { role: "supplier" });
  //   await sendEmail({
  //     to: supplier.email,
  //     subject: "Your Supplier Account is Approved",
  //     html: sendTemplateMail({
  //       type: "success",
  //       email: supplier.email,
  //       subject: "Supplier Account Approved",
  //       message: `Congratulations! Your supplier account has been approved. You can now start adding products "${supplier.shopName}".`,
  //     }),
  //   });
  // } else if (status === "rejected") {
  //   await sendEmail({
  //     to: supplier.email,
  //     subject: "Your Supplier Application is Rejected",
  //     html: sendTemplateMail({
  //       type: "rejected",
  //       email: supplier.email,
  //       subject: "Supplier Application Rejected",
  //       message: `We are sorry! Your supplier application has been rejected. Please review your information and try again later.`,
  //     }),
  //   });
  // }
  // return result;
};

//! Check this one later-------------------------
// const addRejectReason = async (id: string, reason: string) => {
//   const supplier = await JoinAsSupplier.findById(id);
//   if (!supplier) {
//     throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
//   }

//   await JoinAsSupplier.findByIdAndUpdate(
//     id,
//     { rejectReason: reason },
//     { new: true }
//   );
// };

const suspendSupplier = async (id: string) => {
  const supplier = await JoinAsSupplier.findById(id);
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  const newStatus = !supplier.isSuspended;

  await JoinAsSupplier.findByIdAndUpdate(
    id,
    { isSuspended: newStatus },
    { new: true }
  );
};

const deleteSupplier = async (id: string) => {
  const supplier = await JoinAsSupplier.findById(id);

  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  if (supplier.status !== "rejected") {
    throw new AppError(
      "Only rejected suppliers can be deleted.",
      StatusCodes.BAD_REQUEST
    );
  }

  if (!supplier.isSuspended) {
    throw new AppError(
      "Please suspend the supplier before deleting.",
      StatusCodes.BAD_REQUEST
    );
  }

  await JoinAsSupplier.findByIdAndDelete(id);
};

const joinAsSupplierService = {
  joinAsSupplier,
  getMySupplierInfo,
  getAllSuppliers,
  getSingleSupplier,
  updateSupplierStatus,
  suspendSupplier,
  deleteSupplier,
};
export default joinAsSupplierService;
