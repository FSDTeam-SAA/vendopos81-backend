import { Types } from "mongoose";
import AppError from "../errors/AppError";
import Product from "../modules/product/product.model";

const checkProductsExist = async (productIds: Types.ObjectId[]) => {
  const uniqueIds = [...new Set(productIds.map((id) => id.toString()))];

  const count = await Product.countDocuments({
    _id: { $in: uniqueIds },
  });

  if (count !== uniqueIds.length) {
    throw new AppError(
      "Some products do not exist. Please check your request",
      404
    );
  }
};

export default checkProductsExist;
