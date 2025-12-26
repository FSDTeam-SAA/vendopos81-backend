import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import generateShopSlug from "../../middleware/generateShopSlug";
import { ICategory } from "./category.interface";
import category from "./category.model";

const createCategory = async (payload: ICategory) => {
  const isExist = await category.findOne({
    name: { $regex: `^${payload.name}$`, $options: "i" },
  });

  if (isExist) {
    throw new AppError(
      `Category with name ${payload.name} already exists`,
      StatusCodes.CONFLICT
    );
  }

  const slug = generateShopSlug(payload.name);

  const result = await category.create({
    ...payload,
    name: payload.name,
    slug,
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
  const isCategory = await category.findById(id);
  if (!isCategory) {
    throw new AppError("Category not found", StatusCodes.NOT_FOUND);
  }

  if (payload.name) {
    payload.slug = generateShopSlug(payload.name);
  }

  const result = await category.findByIdAndUpdate(id, payload, { new: true });
  return result;
};

const categoryService = {
  createCategory,
  getCategories,
  updateCategory,
};

export default categoryService;
