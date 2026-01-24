import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import config from "../../config";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import { createNotification } from "../../socket/notification.service";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary";
import sendEmail from "../../utils/sendEmail";
import sendTemplateMail from "../../utils/sendTamplateMail";
import { createToken } from "../../utils/tokenGenerate";
import verificationCodeTemplate from "../../utils/verificationCodeTemplate";
import Product from "../product/product.model";
import { IUser } from "../user/user.interface";
import { User } from "../user/user.model";
import { IJoinAsSupplier, IQuery } from "./joinAsSupplier.interface";
import JoinAsSupplier from "./joinAsSupplier.model";

const joinAsSupplier = async (
  payload: IJoinAsSupplier,
  documents: Express.Multer.File[],
  logoFile?: Express.Multer.File,
  currentUser?: IUser,
) => {
  if (!documents || documents.length === 0) {
    throw new AppError(
      "You must upload at least one document",
      StatusCodes.BAD_REQUEST,
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
      "supplier-logos",
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
    let otp: string | null = null;
    let accessToken: string | null = null;
    let tempPassword: string | null = null;

    /** ===============================
     * CASE 1️⃣ Logged-in user
     ===============================*/

    if (currentUser) {
      const dbUser = await User.findById(currentUser.id).session(session);
      if (!dbUser) {
        throw new AppError(
          "Your account does not exist",
          StatusCodes.NOT_FOUND,
        );
      }

      if (payload.shopName) {
        const existingShopName = await User.findOne({
          shopName: { $regex: `^${payload.shopName}$`, $options: "i" },
        }).session(session);

        if (existingShopName) {
          throw new AppError(
            "Shop name already exists. Please choose a different name.",
            StatusCodes.BAD_REQUEST,
          );
        }
      }

      if (payload.brandName) {
        const existingBrandName = await User.findOne({
          brandName: { $regex: `^${payload.brandName}$`, $options: "i" },
        }).session(session);

        if (existingBrandName) {
          throw new AppError(
            "Brand name already exists. Please choose a different name.",
            StatusCodes.BAD_REQUEST,
          );
        }
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
          StatusCodes.BAD_REQUEST,
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
          StatusCodes.BAD_REQUEST,
        );
      }

      const password = Math.floor(100000 + Math.random() * 900000).toString();
      otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otp, 10);
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

      const createdUsers = await User.create(
        [
          {
            email: payload.email,
            phone: payload.phone,
            firstName: payload.firstName,
            lastName: payload.lastName,
            password,
            role: "supplier",
            isVerified: false,
            otp: hashedOtp,
            otpExpires,
          },
        ],
        { session },
      );

      user = createdUsers[0];
      tempPassword = password;

      accessToken = createToken(
        { userId: user._id, email: user.email, role: user.role },
        config.JWT_SECRET as string,
        config.JWT_EXPIRES_IN as string,
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
        "You already have a supplier request",
        StatusCodes.BAD_REQUEST,
      );
    }

    /** ===============================
     * Generate & validate shopSlug
     ===============================*/
    const shopSlug = generateShopSlug(payload.shopName);

    const existingShopSlug = await JoinAsSupplier.findOne({
      shopSlug: { $regex: `^${shopSlug}$`, $options: "i" },
    }).session(session);

    if (existingShopSlug) {
      throw new AppError(
        "Shop name already exists. Please choose a different name.",
        StatusCodes.BAD_REQUEST,
      );
    }

    /** ===============================
     * Validate brandName (optional)
     ===============================*/
    if (payload.brandName) {
      const existingBrand = await JoinAsSupplier.findOne({
        brandName: { $regex: `^${payload.brandName}$`, $options: "i" },
      }).session(session);

      if (existingBrand) {
        throw new AppError(
          "Brand name already exists. Please choose a different name.",
          StatusCodes.BAD_REQUEST,
        );
      }
    }

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
      { session },
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
        html: verificationCodeTemplate(otp as string),
      });
    }

    const adminUsers = await User.findOne({ role: "admin" });

    // Notify admins about new supplier request
    await createNotification({
      to: new mongoose.Types.ObjectId(adminUsers!._id),
      message: `New supplier request from ${user.firstName} ${user.lastName}`,
      type: "supplier_request",
      id: new mongoose.Types.ObjectId(supplierRequest[0]._id),
    });

    return {
      // user,
      supplierRequest: supplierRequest[0],
      accessToken,
    };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    await session.endSession();

    throw new AppError(
      (error as Error).message || "Failed to join as supplier",
      StatusCodes.BAD_REQUEST,
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
  }).populate("userId", "firstName lastName email phone");

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

  // ✅ CreatedAt filter (1 day / 7 days)
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

  // ✅ Search
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
  let sortOption: any = { createdAt: -1 };
  if (query.sort === "atoz") {
    sortOption = { shopName: 1 };
  }

  // ✅ Supplier list
  const suppliers = await JoinAsSupplier.find(combinedFilter)
    .populate("userId", "firstName lastName email phone image")
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const total = await JoinAsSupplier.countDocuments(combinedFilter);
  const totalSupplier = await JoinAsSupplier.countDocuments();
  const totalPending = await JoinAsSupplier.countDocuments({
    status: "pending",
  });
  const totalActive = await JoinAsSupplier.countDocuments({
    status: "approved",
    isSuspended: false,
  });

  // ✅ Total products of all suppliers
  const totalProductsAgg = await Product.aggregate([
    {
      $match: {
        supplierId: { $exists: true },
      },
    },
    {
      $count: "total",
    },
  ]);

  const totalProducts = totalProductsAgg[0]?.total || 0;

  return {
    data: suppliers,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    analytics: {
      totalSupplier,
      totalPending,
      totalActive,
      totalProducts,
    },
  };
};

const getSingleSupplier = async (id: string) => {
  const supplier = await JoinAsSupplier.findById(id).populate(
    "userId",
    "firstName lastName email phone image",
  );
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  return supplier;
};

const updateSupplierStatus = async (id: string, status: string) => {
  const supplier = await JoinAsSupplier.findById(id);
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  const result = await JoinAsSupplier.findByIdAndUpdate(
    id,
    { status },
    { new: true },
  ).populate("userId", "firstName lastName email phone role");

  const user = result?.userId as any;

  // JWT payload
  const JwtToken = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    JwtToken,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  const resetPasswordURL = `${process.env.RESET_PASSWORD_URL}?token=${accessToken}`;
  const dashboardUrl = `${process.env.DASHBOARD_URL}`;

  if (status === "approved") {
    await sendEmail({
      to: supplier.email,
      subject: "Your Supplier Account is Approved",
      html: sendTemplateMail({
        type: "success",
        email: supplier.email,
        subject: "Supplier Account Approved",
        resetPasswordURL,
        dashboardUrl,
        message: `Congratulations! Your supplier account has been approved. You can now start adding products ${supplier.shopName}`,
      }),
    });
  } else if (status === "rejected") {
    await sendEmail({
      to: supplier.email,
      subject: "Your Supplier Account is Rejected",
      html: sendTemplateMail({
        type: "rejected",
        email: supplier.email,
        subject: "Supplier Account Rejected",
        message: `Your supplier account has been rejected. Please try again later.`,
      }),
    });
  }
};

//! Check this one later-------------------------
// const addRejectReason = async (id: string, reason: string) => {}

const suspendSupplier = async (id: string) => {
  const supplier = await JoinAsSupplier.findById(id);
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  const newStatus = !supplier.isSuspended;

  await JoinAsSupplier.findByIdAndUpdate(
    id,
    { isSuspended: newStatus },
    { new: true },
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
      StatusCodes.BAD_REQUEST,
    );
  }

  if (!supplier.isSuspended) {
    throw new AppError(
      "Please suspend the supplier before deleting.",
      StatusCodes.BAD_REQUEST,
    );
  }

  await JoinAsSupplier.findByIdAndDelete(id);
};

const updateSupplierInfo = async (
  id: string,
  data: any,
  documents: Express.Multer.File[],
  logoFile?: Express.Multer.File,
) => {
  const supplier = await JoinAsSupplier.findById(id);

  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  if (supplier.status !== "pending") {
    throw new AppError(
      "Only pending suppliers can be updated.",
      StatusCodes.BAD_REQUEST,
    );
  }

  if (supplier.isSuspended) {
    throw new AppError(
      "Admin suspended your account. Please contact admin.",
      StatusCodes.BAD_REQUEST,
    );
  }

  /** ===============================
   * Upload documents
   ===============================*/
  let uploadedDocuments = supplier.documentUrl || [];

  if (documents?.length > 0) {
    const newDocs = [];

    for (const file of documents) {
      const uploaded = await uploadToCloudinary(
        file.path,
        "supplier-documents",
      );

      newDocs.push({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }

    uploadedDocuments = newDocs; // replace old documents
  }

  /** ===============================
   * Upload logo
   ===============================*/
  let logo = supplier.logo;

  if (logoFile) {
    if (logo?.public_id) {
      await deleteFromCloudinary(logo.public_id);
    }

    const uploadedLogo = await uploadToCloudinary(
      logoFile.path,
      "supplier-logos",
    );

    logo = {
      url: uploadedLogo.secure_url,
      public_id: uploadedLogo.public_id,
    };
  }

  /** ===============================
   * Update USER fields separately
   ===============================*/
  const allowedUserFields = ["firstName", "lastName", "phone"];
  const userData: any = {};

  for (const key of allowedUserFields) {
    if (data[key] !== undefined) {
      userData[key] = data[key];
    }
  }

  if (Object.keys(userData).length > 0) {
    await User.findByIdAndUpdate(supplier.userId, userData, {
      new: true,
      runValidators: true,
    });
  }

  /** ===============================
   * Update SUPPLIER fields only
   ===============================*/
  const allowedSupplierFields = [
    "shopName",
    "brandName",
    "description",
    "warehouseLocation",
    "address",
    "location",
    "street",
    "postalCode",
  ];

  const supplierData: any = {};

  for (const key of allowedSupplierFields) {
    if (data[key] !== undefined) {
      supplierData[key] = data[key];
    }
  }

  const updatedSupplier = await JoinAsSupplier.findByIdAndUpdate(
    id,
    {
      ...supplierData,
      documentUrl: uploadedDocuments,
      logo,
    },
    { new: true, runValidators: true },
  ).populate("userId", "firstName lastName phone email");

  return updatedSupplier;
};

const joinAsSupplierService = {
  joinAsSupplier,
  getMySupplierInfo,
  getAllSuppliers,
  getSingleSupplier,
  updateSupplierStatus,
  suspendSupplier,
  deleteSupplier,
  updateSupplierInfo,
};
export default joinAsSupplierService;
