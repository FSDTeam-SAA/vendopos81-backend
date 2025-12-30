import { StatusCodes } from "http-status-codes";
import countries from "world-countries";
import AppError from "../../errors/AppError";
import { regionMap } from "../../lib/globalType";
import generateShopSlug from "../../middleware/generateShopSlug";
import { ICategory } from "./category.interface";
import category from "./category.model";

// const createCategory = async (payload: ICategory) => {
//   const isExistRegion = await category.findOne({
//     name: { $regex: `^${payload.region}$`, $options: "i" },
//   });

//   if (isExistRegion) {
//     throw new AppError(
//       `${payload.region} category already exists`,
//       StatusCodes.CONFLICT
//     );
//   }

//   const isExistProductType = await category.findOne({
//     name: { $regex: `^${payload.productType}$`, $options: "i" },
//   });

//   if (isExistProductType) {
//     throw new AppError(
//       `${payload.productType} category already exists ${payload.region}`,
//       StatusCodes.CONFLICT
//     );
//   }

//   const slug = generateShopSlug(payload.region || payload.productType || "");

//   const result = await category.create({
//     ...payload,
//     slug,
//   });

//   return result;
// };

const createCategory = async (payload: ICategory) => {
  // 1️⃣ Check if region exists
  const isExistRegion = await category.findOne({
    region: { $regex: `^${payload.region}$`, $options: "i" },
  });
  if (isExistRegion) {
    throw new AppError(
      `${payload.region} category already exists`,
      StatusCodes.CONFLICT
    );
  }

  // 2️⃣ Check if productType exists
  const isExistProductType = await category.findOne({
    productType: { $regex: `^${payload.productType}$`, $options: "i" },
  });
  if (isExistProductType) {
    throw new AppError(
      `${payload.productType} category already exists in ${payload.region}`,
      StatusCodes.CONFLICT
    );
  }

  // 3️⃣ Generate slug
  const slug = generateShopSlug(payload.region || payload.productType || "");

  // Normalize input and ensure mappedRegion is always a string
  const regionInput = payload.region?.trim().toLowerCase() || "";
  const mappedRegion: string = regionMap[regionInput] || payload.region || "";

  // Find countries dynamically (case-insensitive + safe check)
  const countryList = countries
    .filter(
      (c) =>
        (c.subregion &&
          c.subregion.toLowerCase() === mappedRegion.toLowerCase()) ||
        (c.region && c.region.toLowerCase() === mappedRegion.toLowerCase())
    )
    .map((c) => c.name.common);

  const result = await category.create({
    ...payload,
    slug,
    country: countryList,
  });

  return result;
};

const getCategories = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    category.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
    category.countDocuments(),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPage,
    },
  };
};

const updateCategory = async (id: string, payload: ICategory) => {
  // 1️⃣ Find existing category
  const isCategory = await category.findById(id);
  if (!isCategory) {
    throw new AppError("Category not found", StatusCodes.NOT_FOUND);
  }

  // 2️⃣ Generate slug if region or productType updated
  if (payload.region || payload.productType) {
    payload.slug = generateShopSlug(
      payload.region || payload.productType || ""
    );
  }

  // 3️⃣ Auto-populate country if region updated
  if (payload.region) {
    const regionInput = payload.region.toLowerCase().trim();
    const mappedRegion = regionMap[regionInput] || payload.region;

    const countryList = countries
      .filter(
        (c) =>
          c.subregion === mappedRegion || // subregion first
          c.region === mappedRegion // then region
      )
      .map((c) => c.name.common);

    payload.country = countryList;
  }

  // 4️⃣ Update category
  const result = await category.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const deleteCategory = async (id: string) => {
  throw new AppError(
    "Here some logic part will be added don't worry",
    StatusCodes.BAD_REQUEST
  );

  const isCategory = await category.findById(id);
  if (!isCategory) {
    throw new AppError("Category not found", StatusCodes.NOT_FOUND);
  }

  await category.findByIdAndDelete(id);
};

const categoryService = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};

export default categoryService;
