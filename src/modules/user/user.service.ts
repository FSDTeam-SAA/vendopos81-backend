import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import config from "../../config";
import AppError from "../../errors/AppError";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary";
import sendEmail from "../../utils/sendEmail";
import { createToken } from "../../utils/tokenGenerate";
import verificationCodeTemplate from "../../utils/verificationCodeTemplate";
import JoinAsDriver from "../joinAsDriver/joinAsDriver.model";
import { IUser } from "./user.interface";
import { User } from "./user.model";

const registerUser = async (payload: IUser) => {
  const existingUser = await User.isUserExistByEmail(payload.email);
  if (existingUser && existingUser.isVerified) {
    throw new AppError("User already exists", StatusCodes.CONFLICT);
  }

  // Password check
  if (payload.password.length < 6) {
    throw new AppError(
      "Password must be at least 6 characters long",
      StatusCodes.BAD_REQUEST,
    );
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  let result: IUser;

  // Case 2: exists but not verified → update OTP
  if (existingUser && !existingUser.isVerified) {
    result = (await User.findOneAndUpdate(
      { email: existingUser.email },
      { otp: hashedOtp, otpExpires },
      { new: true },
    )) as IUser;
  } else {
    // Case 3: new user
    result = await User.create({
      ...payload,
      otp: hashedOtp,
      otpExpires,
      isVerified: false,
    });
  }

  // Send email
  await sendEmail({
    to: result.email,
    subject: "Verify your email",
    html: verificationCodeTemplate(otp),
  });

  // JWT payload
  const JwtToken = {
    userId: result._id,
    email: result.email,
    role: result.role,
  };

  const accessToken = createToken(
    JwtToken,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  const refreshToken = createToken(
    JwtToken,
    config.refreshTokenSecret as string,
    config.jwtRefreshTokenExpiresIn as string,
  );

  return {
    accessToken,
    refreshToken,
    user: {
      _id: result._id,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
    },
  };
};

const verifyEmail = async (email: string, payload: string) => {
  const { otp }: any = payload;
  if (!otp) throw new Error("OTP is required");

  const existingUser = await User.findOne({ email });
  if (!existingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  if (!existingUser.otp || !existingUser.otpExpires) {
    throw new AppError("OTP not requested or expired", StatusCodes.BAD_REQUEST);
  }

  if (existingUser.otpExpires < new Date()) {
    throw new AppError("OTP has expired", StatusCodes.BAD_REQUEST);
  }

  if (existingUser.isVerified === true) {
    throw new AppError("User already verified", StatusCodes.CONFLICT);
  }

  const isOtpMatched = await bcrypt.compare(otp.toString(), existingUser.otp);
  if (!isOtpMatched) throw new AppError("Invalid OTP", StatusCodes.BAD_REQUEST);

  const result = await User.findOneAndUpdate(
    { email },
    {
      isVerified: true,
      $unset: { otp: "", otpExpires: "" },
    },
    { new: true },
  ).select("username email role");
  return result;
};

const resendOtpCode = async (email: string) => {
  const existingUser = await User.findOne({ email });
  if (!existingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  if (existingUser.isVerified === true) {
    throw new AppError("User already verified", StatusCodes.CONFLICT);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  const result = await User.findOneAndUpdate(
    { email },
    {
      otp: hashedOtp,
      otpExpires,
    },
    { new: true },
  ).select("username email role");

  await sendEmail({
    to: existingUser.email,
    subject: "Verify your email",
    html: verificationCodeTemplate(otp),
  });
  return result;
};

const getAllUsers = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const matchStage: any = {
    role: "customer",
  };

  if (query.isSuspended !== undefined) {
    matchStage.isSuspended = query.isSuspended === "true";
  }

  const result = await User.aggregate([
    {
      $match: matchStage,
    },

    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },

    {
      $addFields: {
        totalOrder: { $size: "$orders" },
        totalSpent: {
          $ifNull: [{ $sum: "$orders.totalPrice" }, 0],
        },
      },
    },

    {
      $sort: { createdAt: -1 },
    },

    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              email: 1,
              createdAt: 1,
              isSuspended: 1,
              totalOrder: 1,
              totalSpent: 1,
            },
          },
        ],

        analytics: [
          {
            $group: {
              _id: null,
              totalCustomer: { $sum: 1 },
              totalActive: {
                $sum: {
                  $cond: [{ $eq: ["$isSuspended", false] }, 1, 0],
                },
              },
              totalSuspended: {
                $sum: {
                  $cond: [{ $eq: ["$isSuspended", true] }, 1, 0],
                },
              },
            },
          },
        ],
      },
    },

    {
      $project: {
        data: 1,
        analytics: {
          $arrayElemAt: ["$analytics", 0],
        },
      },
    },
  ]);

  return {
    users: result[0].data,
    analytics: result[0].analytics,
    meta: {
      total: result[0].analytics.totalCustomer,
      page,
      limit,
      totalPage: result[0].analytics.totalCustomer,
    },
  };
};

const getAdminId = async () => {
  const admin = await User.findOne({ role: "admin" }).select("_id");
  return admin;
};

const getSingleCustomer = async (id: string) => {
  const result = await User.findById(id).select(
    "firstName lastName email role isSuspended image createdAt address phone location postalCode street",
  );
  return result;
};

const getMyProfile = async (email: string) => {
  const existingUser = await User.findOne({ email });
  if (!existingUser)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  const result = await User.findOne({ email }).select(
    "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires",
  );

  return result;
};

const updateUserProfile = async (payload: any, email: string, file: any) => {
  const user = await User.findOne({ email }).select("image");
  if (!user)
    throw new AppError(
      "No account found with the provided credentials.",
      StatusCodes.NOT_FOUND,
    );

  // eslint-disable-next-line prefer-const
  let updateData: any = { ...payload };
  let oldImagePublicId: string | undefined;

  if (file) {
    const uploadResult = await uploadToCloudinary(file.path, "users");
    oldImagePublicId = user.image?.public_id;

    updateData.image = {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
    };
  }

  const result = await User.findOneAndUpdate({ email }, updateData, {
    new: true,
  }).select(
    "-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires",
  );

  if (file && oldImagePublicId) {
    await deleteFromCloudinary(oldImagePublicId);
  }

  return result;
};

const registerDriver = async (payload: any, files: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Check if user already exists
    const existingUser = await User.isUserExistByEmail(payload.email);
    if (existingUser && existingUser.isVerified) {
      throw new AppError("Email already registered", StatusCodes.CONFLICT);
    }

    // 2. Prepare OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    // 3. Create User record (Authentication Layer)
    // Ensure payload includes 'password' from Postman
    const userData = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password, // MANDATORY for User Model
      phone: payload.phone,
      role: "driver",
      otp: hashedOtp,
      otpExpires,
      isVerified: false,
    };

    const newUser = await User.create([userData], { session });

    // 4. Create Driver Profile record (Profile Layer)
    const driverData = {
      userId: newUser[0]._id, // Matches your IJoinAsDriver interface
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      yearsOfExperience: payload.yearsOfExperience,
      licenseExpiryDate: payload.licenseExpiryDate,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      zipCode: payload.zipCode,
      // Handle files from upload.fields(['documents'])
      documentUrl:
        files?.documents?.map((file: any) => ({
          public_id: file.filename,
          url: file.path,
        })) || [],
      status: "pending",
    };

    await JoinAsDriver.create([driverData], { session });

    // 5. Send verification email
    await sendEmail({
      to: newUser[0].email,
      subject: "Verify your Driver Account",
      html: verificationCodeTemplate(otp),
    });

    await session.commitTransaction();
    session.endSession();

    return newUser[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllSuppliers = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const matchStage: any = { role: "supplier" };
  if (query.isSuspended !== undefined) {
    matchStage.isSuspended = query.isSuspended === "true";
  }

  const result = await User.aggregate([
    { $match: matchStage },

    // Join JoinAsSupplier
    {
      $lookup: {
        from: "joinassuppliers",
        localField: "_id",
        foreignField: "userId",
        as: "supplierData",
      },
    },
    { $unwind: { path: "$supplierData", preserveNullAndEmptyArrays: true } },

    // Join Products to count total products
    {
      $lookup: {
        from: "products",
        localField: "supplierData._id",
        foreignField: "supplierId",
        as: "products",
      },
    },
    { $addFields: { totalProduct: { $size: "$products" } } },

    // Sort latest first
    { $sort: { createdAt: -1 } },

    // Pagination + projection + analytics
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              email: 1,
              createdAt: 1,
              isSuspended: 1,
              totalProduct: 1,
              supplierStatus: "$supplierData.status",
              shopName: "$supplierData.shopName",
              brandName: "$supplierData.brandName",
            },
          },
        ],
        analytics: [
          {
            $group: {
              _id: null,
              totalSupplier: { $sum: 1 },
              totalActive: {
                $sum: { $cond: [{ $eq: ["$isSuspended", false] }, 1, 0] },
              },
              totalSuspended: {
                $sum: { $cond: [{ $eq: ["$isSuspended", true] }, 1, 0] },
              },
              totalPending: {
                $sum: {
                  $cond: [{ $eq: ["$supplierData.status", "pending"] }, 1, 0],
                },
              },
              allProduct: { $sum: "$totalProduct" }, // ✅ total all products
            },
          },
        ],
      },
    },
    { $project: { data: 1, analytics: { $arrayElemAt: ["$analytics", 0] } } },
  ]);

  return {
    suppliers: result[0].data,
    analytics: result[0].analytics,
    pagination: {
      page,
      limit,
      total: result[0].analytics.totalSupplier,
      totalPage: Math.ceil(result[0].analytics.totalSupplier / limit),
    },
  };
};

const userService = {
  registerUser,
  verifyEmail,
  resendOtpCode,
  getAllUsers,
  getMyProfile,
  updateUserProfile,
  getAdminId,
  registerDriver,
  getSingleCustomer,
  getAllSuppliers,
};

export default userService;
