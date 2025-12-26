import generateShopSlug from "../../middleware/generateShopSlug";
import { ICategory } from "./category.interface";
import category from "./category.model";

const createCategory = async (payload: ICategory) => {
  const slug = generateShopSlug(payload.name);

  const result = await category.create({ ...payload, slug });
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

const categoryService = {
  createCategory,
  getCategories,
};

export default categoryService;
