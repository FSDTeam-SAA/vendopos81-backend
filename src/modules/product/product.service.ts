import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import { uploadToCloudinary } from "../../utils/cloudinary";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import { User } from "../user/user.model";
import { IProduct } from "./product.interface";
import Product from "./product.model";

const createProduct = async (payload: IProduct, files: any, email: string) => {
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

  if (user.role === "supplier") {
    const isSupplierExist = await JoinAsSupplier.findOne({ userId: user._id });
    if (!isSupplierExist) {
      throw new AppError(
        "You have not applied to be a supplier",
        StatusCodes.BAD_REQUEST
      );
    }

    if (isSupplierExist.status !== "approved") {
      throw new AppError(
        "Your supplier application is not approved yet",
        StatusCodes.BAD_REQUEST
      );
    }

    if (isSupplierExist.isSuspended) {
      throw new AppError(
        "Your supplier account has been suspended",
        StatusCodes.BAD_REQUEST
      );
    }
  }

  const uploadedImages: { url: string; public_id: string }[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, "products");
      uploadedImages.push({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }
  }

  const seoData = payload.seo || {
    metaTitle: payload.title,
    metaDescription: payload.shortDescription,
    keywords: [payload.productType, payload.originCountry],
  };

  const slug = generateShopSlug(payload.title);

  let priceFrom: number | undefined;
  if (payload.variants && payload.variants.length > 0) {
    priceFrom = payload.variants[0].price;
  }

  const data = {
    ...payload,
    images: uploadedImages,
    userId: user._id,
    slug,
    seo: seoData,
    priceFrom,
    addBy: user.role === "supplier" ? "supplier" : "admin",
  };

  const result = await Product.create(data);
  return result;
};

const getMyAddedProducts = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

  const result = await Product.find({ userId: user._id })
    .populate({
      path: "userId",
      select: "firstName lastName email",
    })
    .populate({
      path: "categoryId",
      select: "region",
    });
  return result;
};

const productService = {
  createProduct,
  getMyAddedProducts,
};

export default productService;
