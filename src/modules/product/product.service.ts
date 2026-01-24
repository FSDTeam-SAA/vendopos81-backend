/* eslint-disable prefer-const */
import { StatusCodes } from "http-status-codes";
import { PipelineStage } from "mongoose";
import AppError from "../../errors/AppError";
import { buildAggregationPipeline } from "../../lib/aggregationHelpers";
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
  if (!user) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  if (user.role === "supplier" && user.isSuspended === true) {
    throw new AppError(
      "Your account has been suspended. Please contact support",
      StatusCodes.BAD_REQUEST,
    );
  }

  // 🔹 SUPPLIER VALIDATION:
  if (user.role === "supplier" && user.stripeOnboardingCompleted === false) {
    throw new AppError(
      "You have not completed payment onboarding process",
      StatusCodes.BAD_REQUEST,
    );
  }

  let isSupplierExist = null;
  if (user.role === "supplier") {
    isSupplierExist = await JoinAsSupplier.findOne({ userId: user._id });

    if (!isSupplierExist) {
      throw new AppError(
        "You have not applied to be a supplier",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (isSupplierExist.status !== "approved") {
      throw new AppError(
        "Your supplier application is not approved yet",
        StatusCodes.BAD_REQUEST,
      );
    }

    if (isSupplierExist.isSuspended) {
      throw new AppError(
        "Your supplier account has been suspended",
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  // 🔹 UPLOAD IMAGES
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

  // 🔹 SEO DATA
  const seoData = payload.seo || {
    metaTitle: payload.title,
    metaDescription: payload.shortDescription,
  };

  // 🔹 SLUG
  const slug = generateShopSlug(payload.title);

  // 🔹 VARIANT PROCESSING
  let variants = payload.variants || [];

  // discountPrice calculate
  variants = variants.map((v) => {
    const discount = v.discount ?? 0;

    return {
      ...v,
      discount,
      discountPrice:
        discount > 0 ? v.price - (v.price * discount) / 100 : v.price,
    };
  });

  // sort by lowest price
  variants.sort((a, b) => a.price - b.price);

  // 🔹 PRICE & DISCOUNT LOGIC
  let priceFrom = 0;
  let discountPriceFrom = 0;
  let showOnlyDiscount = 0;

  if (variants.length > 0) {
    const lowestVariant = variants[0];

    // 1️⃣ lowest price
    priceFrom = lowestVariant.price;

    // 2️⃣ discountPriceFrom → only if lowest has discount
    if (lowestVariant.discount! > 0) {
      discountPriceFrom = lowestVariant.discountPrice ?? 0;
      showOnlyDiscount = lowestVariant.discount ?? 0;
    } else {
      discountPriceFrom = 0;

      // 3️⃣ showOnlyDiscount → other variant discount
      const variantWithDiscount = variants.find(
        (v) => v.discount && v.discount > 0,
      );
      showOnlyDiscount = variantWithDiscount?.discount ?? 0;
    }
  }

  // 🔹 PRODUCT DATA
  const data = {
    ...payload,
    images: uploadedImages,
    variants,
    userId: user._id,
    supplierId: user.role === "supplier" ? isSupplierExist!._id : null,
    slug,
    seo: seoData,
    priceFrom,
    discountPriceFrom,
    showOnlyDiscount,
    addBy: user.role === "supplier" ? "supplier" : "admin",
    isVendorBrand: user.role === "admin",
  };

  // 🔹 CREATE PRODUCT
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

const getAllProducts = async (query: any) => {
  const {
    search,
    region,
    originCountry,
    productType,
    unit,
    isHalal,
    isOrganic,
    isFrozen,
    isKosher,
    minPrice,
    maxPrice,
    page = 1,
    limit = 10,
  } = query;

  const pageNumber = Math.max(Number(page), 1);
  const pageLimit = Math.max(Number(limit), 1);
  const skip = (pageNumber - 1) * pageLimit;
  const pipeline: any[] = [];

  pipeline.push({
    $lookup: {
      from: "categories",
      let: { categoryId: "$categoryId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$categoryId"] } } },
        { $project: { _id: 1, region: 1, slug: 1 } },
      ],
      as: "categoryId",
    },
  });
  pipeline.push({
    $unwind: { path: "$categoryId", preserveNullAndEmptyArrays: true },
  });

  // ===================== SUPPLIER LOOKUP =====================
  pipeline.push({
    $lookup: {
      from: "joinassuppliers",
      let: { supplierId: "$supplierId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$supplierId"] } } },
        { $project: { _id: 1, shopName: 1, brandName: 1 } },
      ],
      as: "supplierId",
    },
  });
  pipeline.push({
    $unwind: { path: "$supplierId", preserveNullAndEmptyArrays: true },
  });

  // ===================== WHOLESALE LOOKUP =====================
  pipeline.push({
    $lookup: {
      from: "wholesales",
      let: { wholesaleIds: "$wholesaleId" },
      pipeline: [
        {
          $match: {
            $expr: { $in: ["$_id", "$$wholesaleIds"] },
            isActive: true,
          },
        },
      ],
      as: "wholesaleId",
    },
  });

  // ===================== SEARCH =====================
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

  // ===================== FILTERS =====================
  const match: any = {};

  if (region) match["categoryId.region"] = region;
  if (originCountry) match.originCountry = originCountry;
  if (productType) match.productType = productType;
  if (isHalal !== undefined) match.isHalal = isHalal === "true";
  if (isOrganic !== undefined) match.isOrganic = isOrganic === "true";
  if (isFrozen !== undefined) match.isFrozen = isFrozen === "true";
  if (isKosher !== undefined) match.isKosher = isKosher === "true";

  if (Object.keys(match).length > 0) pipeline.push({ $match: match });

  // ===================== FILTER BY UNIT =====================
  if (unit) {
    pipeline.push({
      $match: {
        "variants.unit": unit,
      },
    });
  }

  // ===================== ADD WHOLESALE MIN PRICE =====================
  pipeline.push({
    $addFields: {
      wholesaleMinPrice: {
        $min: {
          $map: {
            input: "$wholesaleId",
            as: "wh",
            in: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$$wh.type", "case"] },
                    then: { $min: "$$wh.caseItems.price" },
                  },
                  {
                    case: { $eq: ["$$wh.type", "pallet"] },
                    then: { $min: "$$wh.palletItems.price" },
                  },
                ],
                default: null,
              },
            },
          },
        },
      },
    },
  });

  // ===================== PRICE FILTER (Wholesale Aware) =====================
  if (minPrice || maxPrice) {
    pipeline.push({
      $match: {
        $expr: {
          $and: [
            minPrice
              ? {
                  $gte: [
                    { $ifNull: ["$wholesaleMinPrice", "$priceFrom"] },
                    Number(minPrice),
                  ],
                }
              : {},
            maxPrice
              ? {
                  $lte: [
                    { $ifNull: ["$wholesaleMinPrice", "$priceFrom"] },
                    Number(maxPrice),
                  ],
                }
              : {},
          ],
        },
      },
    });
  }

  // ===================== COUNT FOR PAGINATION =====================
  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Product.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // ===================== PAGINATION =====================
  pipeline.push({ $skip: skip }, { $limit: pageLimit });

  // ===================== EXECUTE =====================
  const products = await Product.aggregate(pipeline);

  // ===================== WHOLESALE VS RETAIL FORMAT =====================
  const formattedProducts = products.map((product: any) => {
    const productId = product._id.toString();

    const wholesales = (product.wholesaleId || [])
      .map((wh: any) => {
        if (wh.type === "case") {
          const caseItems = wh.caseItems?.filter(
            (item: any) => item.productId?.toString() === productId,
          );
          if (!caseItems?.length) return null;
          return { ...wh, caseItems };
        }

        if (wh.type === "pallet") {
          const palletItems = wh.palletItems
            ?.map((p: any) => {
              const items = p.items?.filter(
                (i: any) => i.productId?.toString() === productId,
              );
              if (!items?.length) return null;
              return { ...p, items };
            })
            .filter(Boolean);
          if (!palletItems?.length) return null;
          return { ...wh, palletItems };
        }

        return null;
      })
      .filter(Boolean);

    if (wholesales.length > 0) {
      const { variants, priceFrom, discountPriceFrom, ...rest } = product;
      return { ...rest, wholesaleId: wholesales };
    }

    return { ...product, wholesaleId: [] };
  });

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
  const baseFilter: any = {
    $or: [{ wholesaleId: { $exists: false } }, { wholesaleId: { $size: 0 } }],
  };

  const pipeline: PipelineStage[] = [
    // ================= BASE + SEARCH + SORT + PAGINATION =================
    ...buildAggregationPipeline(query, {
      filters: baseFilter,
      searchFields: ["title", "originCountry", "productName", "productType"],
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
    }),

    // ================= LOOKUPS =================
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "joinassuppliers",
        localField: "supplierId",
        foreignField: "_id",
        as: "supplier",
      },
    },
    { $addFields: { supplier: { $arrayElemAt: ["$supplier", 0] } } },

    // ================= DYNAMIC FILTERS =================
    {
      $match: {
        ...(query.categoryRegion && {
          "category.region": query.categoryRegion,
        }),
        ...(query.originCountry && { originCountry: query.originCountry }),
        ...(query.supplierBrand && {
          "supplier.brandName": query.supplierBrand,
        }),
      },
    },

    // ================= PROJECT =================
    {
      $project: {
        title: 1,
        slug: 1,
        shortDescription: 1,
        description: 1,
        images: 1,
        productType: 1,
        productName: 1,
        variants: 1,
        priceFrom: 1,
        shelfLife: 1,
        originCountry: 1,
        isHalal: 1,
        isOrganic: 1,
        isFrozen: 1,
        isKosher: 1,
        isVendorBrand: 1,
        seo: 1,
        averageRating: 1,
        totalRatings: 1,
        totalReviews: 1,
        status: 1,
        isFeatured: 1,
        quantity: 1,
        isAvailable: 1,
        wholesaleId: 1,
        addBy: 1,
        createdAt: 1,
        updatedAt: 1,
        user: { _id: 1, firstName: 1, lastName: 1, email: 1 },
        category: { _id: 1, region: 1 },
        supplier: { _id: 1, shopName: 1, brandName: 1 },
      },
    },
  ];

  const data = await Product.aggregate(pipeline);

  // Count total after base filter (not including dynamic filters for simplicity)
  const total = await Product.countDocuments(baseFilter);

  return {
    meta: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      total,
      totalPage: Math.ceil(total / (Number(query.limit) || 10)),
    },
    data,
  };
};

const getAllWholeSaleProductForAdmin = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [];

  // ================= BASE FILTER =================
  pipeline.push({
    $match: {
      wholesaleId: { $exists: true, $ne: [] },
    },
  });

  // ================= SEARCH =================
  if (query.search) {
    const regex = new RegExp(query.search, "i");
    pipeline.push({
      $match: {
        $or: [
          { title: regex },
          { originCountry: regex },
          { productName: regex },
          { productType: regex },
        ],
      },
    });
  }

  // ================= ORIGIN COUNTRY FILTER =================
  if (query.originCountry) {
    pipeline.push({
      $match: {
        originCountry: new RegExp(`^${query.originCountry}$`, "i"),
      },
    });
  }

  // ================= CATEGORY LOOKUP =================
  pipeline.push(
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
  );

  // ================= REGION FILTER =================
  if (query.categoryRegion) {
    pipeline.push({
      $match: {
        "category.categoryRegion": new RegExp(`^${query.categoryRegion}$`, "i"),
      },
    });
  }

  // ================= SUPPLIER LOOKUP =================
  pipeline.push(
    {
      $lookup: {
        from: "joinassuppliers",
        localField: "supplierId",
        foreignField: "_id",
        as: "supplier",
      },
    },
    { $unwind: "$supplier" },
  );

  // ================= SUPPLIER BRAND FILTER =================
  if (query.supplierBrand) {
    pipeline.push({
      $match: {
        "supplier.brandName": new RegExp(`^${query.supplierBrand}$`, "i"),
      },
    });
  }

  // ================= SORT =================
  let sort: any = { createdAt: -1 };
  if (query.sort === "az") sort = { productName: 1 };
  if (query.sort === "za") sort = { productName: -1 };
  if (query.sort === "old") sort = { createdAt: 1 };

  pipeline.push({ $sort: sort });

  // ================= PAGINATION =================
  pipeline.push({ $skip: skip }, { $limit: limit });

  // ================= WHOLESALE LOOKUP =================
  pipeline.push({
    $lookup: {
      from: "wholesales",
      localField: "wholesaleId",
      foreignField: "_id",
      as: "wholesaleId",
    },
  });

  // ================= SHAPE RESPONSE =================
  pipeline.push({
    $project: {
      title: 1,
      slug: 1,
      productName: 1,
      productType: 1,
      originCountry: 1,
      images: 1,
      status: 1,
      isFeatured: 1,
      createdAt: 1,

      // 👇 rename populated fields
      categoryId: {
        _id: "$category._id",
        region: "$category.region",
        slug: "$category.slug",
      },

      supplierId: {
        _id: "$supplier._id",
        shopName: "$supplier.shopName",
        brandName: "$supplier.brandName",
      },

      wholesaleId: 1,
    },
  });

  const data = await Product.aggregate(pipeline);

  // ================= TOTAL COUNT =================
  const totalPipeline = pipeline.filter(
    (p) => !p.$skip && !p.$limit && !p.$sort,
  );

  totalPipeline.push({ $count: "total" });

  const totalResult = await Product.aggregate(totalPipeline);
  const total = totalResult[0]?.total || 0;

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

const getFeaturedProducts = async () => {
  const products = await Product.find({
    isFeatured: true,
  })
    .populate({
      path: "categoryId",
      select: "region",
    })
    .populate({
      path: "wholesaleId",
      match: {
        type: { $ne: "fastMoving" },
        isActive: true,
      },
    })
    .lean();

  const formattedProducts = products.map((product: any) => {
    const productId = product._id.toString();

    const wholesales = (product.wholesaleId || [])
      .map((wh: any) => {
        // ✅ CASE
        if (wh.type === "case") {
          const caseItems = wh.caseItems.filter(
            (item: any) => item.productId.toString() === productId,
          );

          if (caseItems.length === 0) return null;

          return {
            ...wh,
            caseItems,
          };
        }

        // ✅ PALLET
        if (wh.type === "pallet") {
          const palletItems = wh.palletItems
            .map((pallet: any) => {
              const items = pallet.items.filter(
                (item: any) => item.productId.toString() === productId,
              );

              if (items.length === 0) return null;

              return {
                ...pallet,
                items,
              };
            })
            .filter(Boolean);

          if (palletItems.length === 0) return null;

          return {
            ...wh,
            palletItems,
          };
        }

        return null;
      })
      .filter(Boolean);

    // 🔥 🔥 IMPORTANT PART 🔥 🔥
    // যদি wholesale থাকে → retail data remove
    if (wholesales.length > 0) {
      const { variants, priceFrom, ...restProduct } = product;

      return {
        ...restProduct,
        wholesaleId: wholesales,
      };
    }

    // যদি wholesale না থাকে → সব data থাকবে
    return {
      ...product,
      wholesaleId: [],
    };
  });

  return formattedProducts;
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
    (item) => item.productId,
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

const getFilterCategories = async () => {
  const result = await Product.aggregate([
    // Join categories
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

    // Join suppliers
    {
      $lookup: {
        from: "joinassuppliers",
        localField: "supplierId",
        foreignField: "_id",
        as: "supplier",
      },
    },
    { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

    // Group to get unique values
    {
      $group: {
        _id: null,
        allBrands: { $addToSet: "$supplier.brandName" },
        allRegion: { $addToSet: "$category.region" },
        allOriginCountry: { $addToSet: "$originCountry" },
      },
    },

    // Project only needed fields
    {
      $project: {
        _id: 0,
        allBrands: 1,
        allRegion: 1,
        allOriginCountry: 1,
      },
    },
  ]);

  return result[0] || { allBrands: [], allRegion: [], allOriginCountry: [] };
};

const getSingleProduct = async (id: string) => {
  const isProductExist = await Product.findById(id);
  if (!isProductExist) {
    throw new AppError("Product not found", StatusCodes.NOT_FOUND);
  }

  let product: any = await Product.findById(id)
    .populate({
      path: "categoryId",
      select: "region",
    })
    .populate({
      path: "wholesaleId", // এখানে fastMoving বাদ দিচ্ছি না!
      match: { isActive: true },
    })
    .lean();

  const productId = id.toString();

  // wholesale filtering (same pattern as listing)
  const wholesales = (product.wholesaleId || [])
    .map((wh: any) => {
      // CASE
      if (wh.type === "case") {
        const caseItems = wh.caseItems.filter(
          (item: any) => item.productId.toString() === productId,
        );

        if (caseItems.length === 0) return null;

        return {
          ...wh,
          caseItems,
        };
      }

      // PALLET
      if (wh.type === "pallet") {
        const palletItems = wh.palletItems
          .map((pallet: any) => {
            const items = pallet.items.filter(
              (item: any) => item.productId.toString() === productId,
            );
            if (items.length === 0) return null;

            return {
              ...pallet,
              items,
            };
          })
          .filter(Boolean);

        if (palletItems.length === 0) return null;

        return {
          ...wh,
          palletItems,
        };
      }
    })
    .filter(Boolean);

  // === OUTPUT FORMAT (Single Product) ===
  if (wholesales.length > 0) {
    // remove retail data
    const { variants, priceFrom, ...restProduct } = product;

    return {
      ...restProduct,
      wholesaleId: wholesales,
    };
  }

  // No wholesale → return retail
  return {
    ...product,
    wholesaleId: [],
  };
};

const getTopRatedProducts = async () => {
  const products = await Product.find({
    // status: "approved", //!If you want to show only approved products
    averageRating: { $gt: 0 },
  })
    .sort({ averageRating: -1 })
    .limit(10)
    .populate({
      path: "categoryId",
      select: "region slug",
    })
    .populate({
      path: "supplierId",
      select: "shopName brandName",
    })
    .populate({
      path: "wholesaleId",
      match: { type: { $ne: "fastMoving" }, isActive: true },
      select: "-__v -createdAt -updatedAt",
    })
    .lean();

  const formattedProducts = products.map((p: any) => {
    const hasWholesale = p.wholesaleId && p.wholesaleId.length > 0;

    return {
      ...p,
      variants: hasWholesale ? [] : p.variants || [],
    };
  });

  return formattedProducts;

  // return products;
};

const getCaseDealsProducts = async () => {
  // Step 1: Find all products that are available and approved
  const products = await Product.find({
    isAvailable: true,
    // status: "approved", //!If you want to show only approved products
  })
    .populate({
      path: "categoryId",
      select: "region slug",
    })
    .populate({
      path: "supplierId",
      select: "shopName brandName",
    })
    .populate({
      path: "wholesaleId",
      match: { type: "case", isActive: true }, // only case wholesale
      select: "-__v -createdAt -updatedAt",
    })
    .lean();

  // Step 2: Format products: remove variants if case wholesale exists
  const formattedProducts = products.map((p: any) => {
    const hasCaseWholesale = p.wholesaleId && p.wholesaleId.length > 0;

    return {
      ...p,
      variants: hasCaseWholesale ? [] : p.variants || [],
    };
  });

  // Step 3: Return only products that have at least 1 case wholesale
  return formattedProducts.filter((p: any) => p.wholesaleId.length > 0);
};

const getRelatedProducts = async (productId: string) => {
  const product = await Product.findById(productId).select("categoryId").lean();

  if (!product || !product.categoryId) {
    return [];
  }
  const categoryId = product.categoryId;

  const relatedProducts = await Product.find({
    _id: { $ne: productId },
    categoryId: categoryId,
    // status: "approved",
    // isAvailable: true,
  })
    .populate({
      path: "categoryId",
      select: "region slug",
    })
    .populate({
      path: "supplierId",
      select: "shopName brandName",
    })
    .populate({
      path: "wholesaleId",
      match: { type: "case", isActive: true },
      select: "-__v -createdAt -updatedAt",
    })
    .lean();

  return relatedProducts;
};

const updateProductStatus = async (id: string, status: string) => {
  const isProductExist = await Product.findById(id);
  if (!isProductExist) {
    throw new AppError("Product not found", StatusCodes.NOT_FOUND);
  }

  await Product.findOneAndUpdate(
    { _id: isProductExist._id },
    { status },
    { new: true },
  );
};

const updateProduct = async (
  id: string,
  payload: IProduct,
  files: Express.Multer.File[],
  email: string,
) => {
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

  const product = await Product.findById(id);
  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  let isSupplierExist = null;
  if (user.role === "supplier") {
    isSupplierExist = await JoinAsSupplier.findOne({ userId: user._id });
    if (!isSupplierExist)
      throw new AppError(
        "You have not applied to be a supplier",
        StatusCodes.BAD_REQUEST,
      );
    if (isSupplierExist.status !== "approved")
      throw new AppError(
        "Your supplier application is not approved yet",
        StatusCodes.BAD_REQUEST,
      );
    if (isSupplierExist.isSuspended)
      throw new AppError(
        "Your supplier account has been suspended",
        StatusCodes.BAD_REQUEST,
      );
  }

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
  };

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
  getFeaturedProducts,
  getSingleProduct,
  getAllProducts,
  getAllProductForAdmin,
  getFilterCategories,
  getTopRatedProducts,
  getCaseDealsProducts,
  getRelatedProducts,
  updateProductStatus,
  updateProduct,
};

export default productService;
