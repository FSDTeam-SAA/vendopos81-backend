import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { User } from "../user/user.model";
import { IJoinAsSupplier } from "./joinAsSupplier.interface";
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

const joinAsSupplierService = {
  joinAsSupplier,
  getMySupplierInfo,
};
export default joinAsSupplierService;
