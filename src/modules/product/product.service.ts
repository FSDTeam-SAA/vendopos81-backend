import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import { User } from "../user/user.model";
import { IProduct } from "./product.interface";
import Product from "./product.model";

const createProduct = async (payload: IProduct, files: any, email: string) => {
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

  let isSupplierExist = null;

  if (user.role === "supplier") {
    isSupplierExist = await JoinAsSupplier.findOne({ userId: user._id });
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
    // keywords: [payload.productType, payload.originCountry],
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
    supplierId: user.role === "supplier" ? isSupplierExist!._id : null,
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

  const result = await Product.find({ userId: user._id }).populate({
    path: "categoryId",
    select: "region",
  });
  return result;
};

const getAllProducts = async () => {
  const result = await Product.find()
    // .populate({
    //   path: "userId",
    //   select: "firstName lastName email",
    // })
    .populate({
      path: "categoryId",
      select: "region",
    })
    .populate({
      path: "supplierId",
      select: "shopName brandName logo",
    });
  return result;
};

const getSingleProduct = async (id: string) => {
  const isProductExist = await Product.findById(id);
  if (!isProductExist) {
    throw new AppError("Product not found", StatusCodes.NOT_FOUND);
  }

  const result = await Product.findById(id)
    .populate({
      path: "userId",
      select: "firstName lastName email",
    })
    .populate({
      path: "categoryId",
      select: "region",
    })
    .populate({
      path: "supplierId",
      select: "shopName brandName logo",
    });
  return result;
};

const updateProductStatus = async (id: string, status: string) => {
  const isProductExist = await Product.findById(id);
  if (!isProductExist) {
    throw new AppError("Product not found", StatusCodes.NOT_FOUND);
  }

  await Product.findOneAndUpdate(
    { _id: isProductExist._id },
    { status },
    { new: true }
  );
};

const updateProduct = async (
  id: string,
  payload: IProduct,
  files: Express.Multer.File[],
  email: string
) => {
  // 1️⃣ Find user
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

  // 2️⃣ Check product exists
  const product = await Product.findById(id);
  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  // 3️⃣ Supplier validation
  let isSupplierExist = null;
  if (user.role === "supplier") {
    isSupplierExist = await JoinAsSupplier.findOne({ userId: user._id });
    if (!isSupplierExist)
      throw new AppError(
        "You have not applied to be a supplier",
        StatusCodes.BAD_REQUEST
      );
    if (isSupplierExist.status !== "approved")
      throw new AppError(
        "Your supplier application is not approved yet",
        StatusCodes.BAD_REQUEST
      );
    if (isSupplierExist.isSuspended)
      throw new AppError(
        "Your supplier account has been suspended",
        StatusCodes.BAD_REQUEST
      );
  }

  // 4️⃣ Upload new images if provided
  const uploadedImages: { url: string; public_id: string }[] = [];
  if (files && files.length > 0) {
    for (const img of Array.isArray(product.images) ? product.images : []) {
      await deleteFromCloudinary(img.public_id);
    }

    for (const file of files) {
      const uploaded = await uploadToCloudinary(file.path, "products");
      uploadedImages.push({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }
  }

  const seoData = payload.seo || {
    metaTitle: payload.title || product.title,
    metaDescription: payload.shortDescription || product.shortDescription,
    // keywords: [payload.productType, payload.originCountry].filter(Boolean),
  };

  // 6️⃣ Handle slug
  const slug = payload.slug || generateShopSlug(payload.title || product.title);

  // 7️⃣ Handle priceFrom from first variant
  let priceFrom: number | undefined = product.priceFrom;
  if (payload.variants && payload.variants.length > 0) {
    priceFrom = payload.variants[0].price;
  }

  // 8️⃣ Prepare update data
  const updatedData: Partial<IProduct> = {
    ...payload,
    images: (uploadedImages.length > 0
      ? uploadedImages
      : product.images) as any,
    slug,
    seo: seoData,
    priceFrom,
    addBy: user.role === "supplier" ? "supplier" : "admin",
  };

  // 9️⃣ Update product in DB
  const result = await Product.findByIdAndUpdate(id, updatedData, {
    new: true,
  });
  return result;
};

const productService = {
  createProduct,
  getMyAddedProducts,
  getSingleProduct,
  getAllProducts,
  updateProductStatus,
  updateProduct,
};

export default productService;
