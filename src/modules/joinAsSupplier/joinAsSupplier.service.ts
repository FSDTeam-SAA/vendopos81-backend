import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import { uploadToCloudinary } from "../../utils/cloudinary";
import sendEmail from "../../utils/sendEmail";
import sendTemplateMail from "../../utils/sendTamplateMail";
import { User } from "../user/user.model";
import { IJoinAsSupplier, IQuery } from "./joinAsSupplier.interface";
import JoinAsSupplier from "./joinAsSupplier.model";

const joinAsSupplier = async (
  email: string,
  payload: IJoinAsSupplier,
  files: any
) => {
  const user = await User.isUserExistByEmail(email);
  if (!user) {
    throw new Error("Your account does not exist");
  }

  if (user.role === "supplier") {
    throw new Error("You are already a supplier");
  }

  const existingRequest = await JoinAsSupplier.findOne({
    userId: user._id,
  });

  if (existingRequest) {
    if (existingRequest.status === "pending") {
      throw new Error("Your supplier request is under review");
    }

    if (existingRequest.status === "approved") {
      throw new Error("You are already approved as a supplier");
    }
  }

  const shopSlug = generateShopSlug(payload.shopName);

  const slugExists = await JoinAsSupplier.findOne({ shopSlug });
  if (slugExists) {
    throw new Error("Shop name already exists, choose another name");
  }

  if (!files || files.length === 0) {
    throw new AppError(
      "At least one document is required",
      StatusCodes.BAD_REQUEST
    );
  }

  const uploadedImages: { url: string; publickey: string }[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, "products");
      uploadedImages.push({
        url: uploaded.secure_url,
        publickey: uploaded.public_id,
      });
    }
  }

  const result = await JoinAsSupplier.create({
    ...payload,
    documentUrl: uploadedImages,
    shopSlug,
    userId: user._id,
    status: "pending",
  });

  return result;
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
  const supplier = await JoinAsSupplier.findById(id);
  if (!supplier) {
    throw new AppError("Supplier not found", StatusCodes.NOT_FOUND);
  }

  const validStatuses = ["pending", "approved", "rejected"];
  if (!validStatuses.includes(status)) {
    throw new AppError("Invalid status value", StatusCodes.BAD_REQUEST);
  }

  await JoinAsSupplier.findByIdAndUpdate(id, { status }, { new: true });

  // ✅ Email content
  if (status === "approved") {
    await User.findByIdAndUpdate(supplier.userId, { role: "supplier" });

    await sendEmail({
      to: supplier.email,
      subject: "Your Supplier Account is Approved",
      html: sendTemplateMail({
        type: "success",
        email: supplier.email,
        subject: "Supplier Account Approved",
        message: `Congratulations! Your supplier account has been approved. You can now start adding products "${supplier.shopName}".`,
      }),
    });
  } else if (status === "rejected") {
    await sendEmail({
      to: supplier.email,
      subject: "Your Supplier Application is Rejected",
      html: sendTemplateMail({
        type: "rejected",
        email: supplier.email,
        subject: "Supplier Application Rejected",
        message: `We are sorry! Your supplier application has been rejected. Please review your information and try again later.`,
      }),
    });
  }

  // return result;
};

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
