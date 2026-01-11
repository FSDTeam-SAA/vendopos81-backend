import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import { User } from "../user/user.model";
import Wholesale from "../wholeSale/wholeSale.model";
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
    isVendorBrand: user.role === "admin" ? true : false,
  };

  const result = await Product.create(data);
  return result;
};

//!____________________________________________________________________________

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

//! only for approved products
const getAllProducts = async (query: any) => {
  const {
    search,
    region,
    productType,
    minPrice,
    maxPrice,
    page = 1,
    limit = 10,
  } = query;

  const pageNumber = Math.max(Number(page), 1);
  const pageLimit = Math.max(Number(limit), 1);
  const skip = (pageNumber - 1) * pageLimit;

  const pipeline: any[] = [];

  /* =====================================================
     CATEGORY LOOKUP (clean fields)
  ===================================================== */
  pipeline.push({
    $lookup: {
      from: "categories",
      let: { categoryId: "$categoryId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$categoryId"] } } },
        { $project: { _id: 1, region: 1, slug: 1 } }, // only required fields
      ],
      as: "categoryId",
    },
  });

  pipeline.push({
    $unwind: { path: "$categoryId", preserveNullAndEmptyArrays: true },
  });

  /* =====================================================
     SUPPLIER LOOKUP (only shopName & brandName)
  ===================================================== */
  pipeline.push({
    $lookup: {
      from: "joinassuppliers", // JoinAsSupplier collection
      let: { supplierId: "$supplierId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$supplierId"] } } },
        { $project: { _id: 1, shopName: 1, brandName: 1 } }, // ONLY these two
      ],
      as: "supplierId",
    },
  });

  pipeline.push({
    $unwind: { path: "$supplierId", preserveNullAndEmptyArrays: true },
  });

  /* =====================================================
     WHOLESALE LOOKUP
  ===================================================== */
  pipeline.push({
    $lookup: {
      from: "wholesales",
      let: { wholesaleIds: "$wholesaleId" },
      pipeline: [
        {
          $match: {
            $expr: { $in: ["$_id", "$$wholesaleIds"] },
            type: { $ne: "fastMoving" },
            isActive: true,
          },
        },
      ],
      as: "wholesaleId",
    },
  });

  /* =====================================================
     SEARCH
  ===================================================== */
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { productName: { $regex: search, $options: "i" } },
          { productType: { $regex: search, $options: "i" } },
          { "supplierId.shopName": { $regex: search, $options: "i" } },
          { "supplierId.brandName": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  /* =====================================================
     FILTERS
  ===================================================== */
  if (region) {
    pipeline.push({ $match: { "categoryId.region": region } });
  }

  if (productType) {
    pipeline.push({ $match: { productType } });
  }

  if (minPrice || maxPrice) {
    pipeline.push({
      $match: {
        priceFrom: {
          ...(minPrice && { $gte: Number(minPrice) }),
          ...(maxPrice && { $lte: Number(maxPrice) }),
        },
      },
    });
  }

  /* =====================================================
     COUNT FOR PAGINATION
  ===================================================== */
  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Product.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  /* =====================================================
     PAGINATION
  ===================================================== */
  pipeline.push({ $skip: skip }, { $limit: pageLimit });

  /* =====================================================
     EXECUTE QUERY
  ===================================================== */
  const products = await Product.aggregate(pipeline);

  /* =====================================================
     WHOLESALE VS RETAIL FORMAT
  ===================================================== */
  const formattedProducts = products.map((product: any) => {
    const productId = product._id.toString();

    const wholesales = (product.wholesaleId || [])
      .map((wh: any) => {
        if (wh.type === "case") {
          const caseItems = wh.caseItems?.filter(
            (item: any) => item.productId?.toString() === productId
          );
          if (!caseItems || caseItems.length === 0) return null;
          return { ...wh, caseItems };
        }

        if (wh.type === "pallet") {
          const palletItems = wh.palletItems
            ?.map((p: any) => {
              const items = p.items?.filter(
                (i: any) => i.productId?.toString() === productId
              );
              if (!items || items.length === 0) return null;
              return { ...p, items };
            })
            .filter(Boolean);
          if (!palletItems || palletItems.length === 0) return null;
          return { ...wh, palletItems };
        }

        return null;
      })
      .filter(Boolean);

    if (wholesales.length > 0) {
      const { variants, priceFrom, ...rest } = product;
      return { ...rest, wholesaleId: wholesales };
    }

    return { ...product, wholesaleId: [] };
  });

  /* =====================================================
     FINAL RESPONSE
  ===================================================== */
  return {
    meta: {
      page: pageNumber,
      limit: pageLimit,
      total,
      totalPage: Math.ceil(total / pageLimit),
    },
    data: formattedProducts,
  };
};

const getAllProductForAdmin = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  // 🔴 Only products WITHOUT wholesaleId
  const filter = {
    $or: [{ wholesaleId: { $exists: false } }, { wholesaleId: { $size: 0 } }],
  };

  const data = await Product.find(filter)
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
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(filter);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

const getAllWholeSaleProductForAdmin = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {
    wholesaleId: { $exists: true, $ne: [] },
  };

  const products = await Product.find(filter)
    .select("-variants")
    .populate("wholesaleId")
    .populate({
      path: "categoryId",
      select: "region slug",
    })
    .populate({
      path: "supplierId",
      select: "shopName brandName",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const data = products.map((product) => {
    const productId = product._id.toString();

    const filteredWholesale = product
      .wholesaleId! // ❌ remove fastMoving type
      .filter((wh: any) => wh.type !== "fastMoving")
      // ✅ filter items inside wholesale
      .map((wh: any) => {
        const whObj = wh.toObject();

        // PALLET
        if (whObj.type === "pallet") {
          whObj.palletItems = whObj.palletItems.map((pallet: any) => ({
            ...pallet,
            items: pallet.items.filter(
              (item: any) => item.productId.toString() === productId
            ),
          }));
        }

        // CASE
        if (whObj.type === "case") {
          whObj.caseItems = whObj.caseItems.filter(
            (item: any) => item.productId.toString() === productId
          );
        }

        return whObj;
      });

    return {
      _id: product._id,
      userId: product.userId,
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      title: product.title,
      slug: product.slug,
      shortDescription: product.shortDescription,
      description: product.description,
      images: product.images,
      productType: product.productType,
      productName: product.productName,
      shelfLife: product.shelfLife,
      originCountry: product.originCountry,
      isHalal: product.isHalal,
      isOrganic: product.isOrganic,
      isFrozen: product.isFrozen,
      isKosher: product.isKosher,
      seo: product.seo,
      averageRating: product.averageRating,
      totalRatings: product.totalRatings,
      totalReviews: product.totalReviews,
      status: product.status,
      isFeatured: product.isFeatured,
      addBy: product.addBy,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      wholesaleId: filteredWholesale,
      isAvailable: product.isAvailable,
      quantity: product.quantity,
    };
  });

  const total = await Product.countDocuments(filter);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

const getFastMovingProducts = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const fastMovingWholesale = await Wholesale.findOne({
    type: "fastMoving",
    isActive: true,
  });

  if (!fastMovingWholesale) {
    return {
      meta: { page, limit, total: 0, totalPage: 0 },
      data: [],
    };
  }

  const productIds = fastMovingWholesale.fastMovingItems!.map(
    (item) => item.productId
  );

  const products = await Product.find({
    _id: { $in: productIds },
  })
    .select("-variants")
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
    })
    .populate({
      path: "wholesaleId",
      match: { type: "fastMoving" },
    })
    .skip(skip)
    .limit(limit);

  return {
    meta: {
      page,
      limit,
      total: productIds.length,
      totalPage: Math.ceil(productIds.length / limit),
    },
    data: products,
  };
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
  getAllWholeSaleProductForAdmin,
  getFastMovingProducts,
  getSingleProduct,
  getAllProducts,
  getAllProductForAdmin,
  updateProductStatus,
  updateProduct,
};

export default productService;
