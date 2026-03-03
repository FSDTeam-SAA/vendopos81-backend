import mongoose from "mongoose";
import countries from "world-countries";
import AppError from "../../errors/AppError";
import { regionMap, sanitizeRegion } from "../../lib/globalType";
import generateShopSlug from "../../middleware/generateShopSlug";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../../utils/cloudinary";
import { ICategory } from "./category.interface";
import category from "./category.model";

const createCategory = async (
  payload: ICategory,
  files: Express.Multer.File[],
  regionImg?: Express.Multer.File,
) => {
  const regionName = payload.region.trim();

  // 🔥 Duplicate region check (case-insensitive)
  const existingRegion = await category.findOne({
    region: { $regex: `^${regionName}$`, $options: "i" },
  });

  if (existingRegion) {
    throw new AppError(`Region "${regionName}" already exists`, 409);
  }

  // Region image required for new region
  if (!regionImg) {
    throw new AppError("Region image is required", 400);
  }

  // Map files
  const filesMap: Record<string, Express.Multer.File> = {};
  files.forEach((file) => {
    filesMap[file.fieldname] = file;
  });

  // Upload productType images
  const categoriesWithImages = await Promise.all(
    payload.categories.map(async (cat, index) => {
      const fileKey = `categories[${index}][productTypeImage]`;
      const productFile = filesMap[fileKey];

      if (!productFile) {
        throw new AppError(
          `ProductType image missing for ${cat.productType}`,
          400,
        );
      }

      const uploaded = await uploadToCloudinary(
        productFile.path,
        "product-type-img",
      );

      return {
        productType: cat.productType,
        productName: cat.productName,
        productImage: {
          url: uploaded.secure_url,
          public_id: uploaded.public_id,
        },
      };
    }),
  );

  // Upload region image
  const uploadedRegionImage = await uploadToCloudinary(
    regionImg.path,
    "region-img",
  );

  // Helper function
  const getCountriesByRegion = (inputRegion: string): string[] => {
    const cleanInput = sanitizeRegion(inputRegion);
    const mappedRegion = regionMap[cleanInput] || inputRegion;
    const mappedRegionLower = mappedRegion.toLowerCase();

    return countries
      .filter((c) => {
        const countryRegion = c.region?.toLowerCase() || "";
        const countrySubregion = c.subregion?.toLowerCase() || "";

        return (
          countryRegion.includes(mappedRegionLower) ||
          countrySubregion.includes(mappedRegionLower) ||
          mappedRegionLower.includes(countryRegion) ||
          mappedRegionLower.includes(countrySubregion)
        );
      })
      .map((c) => c.name.common);
  };

  const countryList = getCountriesByRegion(regionName);

  const result = await category.create({
    region: regionName,
    categories: categoriesWithImages,
    country: countryList,
    regionImage: {
      url: uploadedRegionImage.secure_url,
      public_id: uploadedRegionImage.public_id,
    },
  });

  return result;
};

interface IGetCategoriesParams {
  page: number;
  limit: number;
  region?: string;
  productType?: string;
}

const getCategories = async ({
  page,
  limit,
  region, // now this should be region _id as string
  productType,
}: IGetCategoriesParams) => {
  const skip = (page - 1) * limit;
  const filter: Record<string, any> = {};

  if (region) {
    // Convert string to ObjectId
    if (!mongoose.Types.ObjectId.isValid(region)) {
      throw new AppError("Invalid region id", 400);
    }
    filter._id = new mongoose.Types.ObjectId(region);
  }

  const [data, total] = await Promise.all([
    category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    category.countDocuments(filter),
  ]);

  const totalPage = Math.ceil(total / limit);

  let allProductTypes: string[] = [];
  let allProductNames: string[] = [];

  if (region && data.length > 0) {
    const regionData = data[0];

    if (productType) {
      const foundCategory = regionData.categories.find(
        (c: any) => c.productType.toLowerCase() === productType.toLowerCase(),
      );

      if (foundCategory) {
        allProductTypes = [foundCategory.productType];
        allProductNames = foundCategory.productName;
      }
    } else {
      allProductTypes = regionData.categories.map((c: any) => c.productType);
      allProductNames = regionData.categories.flatMap(
        (c: any) => c.productName,
      );
    }
  }

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
    filters: {
      productTypes: allProductTypes,
      productNames: allProductNames,
    },
  };
};

const updateCategory = async (
  id: string,
  payload: ICategory,
  files: Express.Multer.File[],
) => {
  const isCategory = await category.findById(id);
  if (!isCategory) {
    throw new AppError("Category not found", 404);
  }

  // 🔹 map files by fieldname
  const filesMap: { [key: string]: Express.Multer.File } = {};
  files.forEach((f) => {
    filesMap[f.fieldname] = f;
  });

  // 🔹 Update regionImage if provided
  if (filesMap["regionImage"]) {
    if (isCategory.regionImage?.public_id) {
      await deleteFromCloudinary(isCategory.regionImage.public_id);
    }
    const uploadedRegion = await uploadToCloudinary(
      filesMap["regionImage"].path,
      "region-img",
    );
    payload.regionImage = {
      url: uploadedRegion.secure_url,
      public_id: uploadedRegion.public_id,
    };
  }

  // 🔹 Update existing categories or add new categories
  if (payload.categories && payload.categories.length > 0) {
    for (let i = 0; i < payload.categories.length; i++) {
      const cat = payload.categories[i];
      const fileKey = `categories[${i}][productTypeImage]`;
      const productFile = filesMap[fileKey];

      // Upload image if file provided
      if (productFile) {
        const uploaded = await uploadToCloudinary(
          productFile.path,
          "product-type-img",
        );
        cat.productImage = {
          url: uploaded.secure_url,
          public_id: uploaded.public_id,
        };
      } else if (!cat.productImage) {
        throw new AppError(`Product image missing for ${cat.productType}`, 400);
      }

      // Check if productType already exists in this region
      const existProductType = isCategory.categories.find(
        (c) => c.productType.toLowerCase() === cat.productType.toLowerCase(),
      );

      if (existProductType) {
        // Update existing productType
        existProductType.productName = cat.productName;
        if (cat.productImage) existProductType.productImage = cat.productImage;
      } else {
        // Add new productType
        isCategory.categories.push(cat);
      }
    }
  }

  // 🔹 Update region name and slug
  if (payload.region) {
    const isExistRegion = await category.findOne({
      _id: { $ne: id },
      region: { $regex: `^${payload.region}$`, $options: "i" },
    });
    if (isExistRegion) {
      throw new AppError(`${payload.region} already exists`, 409);
    }
    isCategory.region = payload.region;
    isCategory.slug = generateShopSlug(payload.region);

    // Update countries
    const regionInput = payload.region.trim().toLowerCase();
    const mappedRegion = regionMap[regionInput] || payload.region;
    isCategory.country = countries
      .filter(
        (c) =>
          c.subregion?.toLowerCase() === mappedRegion.toLowerCase() ||
          c.region?.toLowerCase() === mappedRegion.toLowerCase(),
      )
      .map((c) => c.name.common);
  }

  // 🔹 Save updated category
  await isCategory.save();

  return isCategory;
};

const getCategoryRegion = async () => {
  const regions = await category.aggregate([
    {
      $group: {
        _id: "$region",
        docId: { $first: "$_id" },
        regionImage: { $first: "$regionImage" },
      },
    },
    {
      $project: {
        _id: "$docId",
        region: "$_id",
        regionImage: 1,
      },
    },
  ]);

  return regions;
};

const categoryService = {
  createCategory,
  getCategories,
  updateCategory,
  getCategoryRegion,
};

export default categoryService;
