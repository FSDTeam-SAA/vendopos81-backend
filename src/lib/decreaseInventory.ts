import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import AppError from "../errors/AppError";
import Product from "../modules/product/product.model";

// Interface for order item
export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  wholesaleId?: mongoose.Types.ObjectId;
  quantity: number;
  unitPrice: number;
}

export const decreaseInventory = async (
  item: any, // using any to avoid TS errors
  session: mongoose.ClientSession
) => {
  // Fetch product with wholesale populated
  const product: any = await Product.findById(item.productId)
    .populate("wholesaleId")
    .session(session);

  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  // ===== Variant stock =====
  if (item.variantId) {
    const variant = product.variants?.find(
      (v: any) => v._id.toString() === item.variantId.toString()
    );
    if (!variant)
      throw new AppError("Variant not found", StatusCodes.BAD_REQUEST);
    if (variant.stock < item.quantity)
      throw new AppError("Not enough variant stock", StatusCodes.BAD_REQUEST);

    variant.stock -= item.quantity;
  }

  // ===== Wholesale stock =====
  if (item.wholesaleId) {
    const wholesales = product.wholesaleId || [];
    const wholesale: any = wholesales.find(
      (w: any) => w._id.toString() === item.wholesaleId.toString()
    );

    if (!wholesale)
      throw new AppError("Wholesale offer not found", StatusCodes.BAD_REQUEST);

    // Case type
    if (wholesale.type === "case") {
      const caseItem = wholesale.caseItems?.find(
        (c: any) => c.productId.toString() === product._id.toString()
      );
      if (!caseItem)
        throw new AppError("Case item not found", StatusCodes.BAD_REQUEST);
      if (caseItem.quantity < item.quantity)
        throw new AppError("Not enough case quantity", StatusCodes.BAD_REQUEST);

      caseItem.quantity -= item.quantity;
    }

    // Pallet type
    if (wholesale.type === "pallet") {
      const pallet = wholesale.palletItems?.[0];
      if (!pallet)
        throw new AppError("Pallet not found", StatusCodes.BAD_REQUEST);
      if (pallet.totalCases < item.quantity)
        throw new AppError(
          "Not enough pallet quantity",
          StatusCodes.BAD_REQUEST
        );

      pallet.totalCases -= item.quantity;
    }
  }

  // ===== Normal stock =====
  if (!item.variantId && !item.wholesaleId) {
    if (product.quantity == null)
      throw new AppError("Product stock not defined", StatusCodes.BAD_REQUEST);
    if (product.quantity < item.quantity)
      throw new AppError("Not enough stock", StatusCodes.BAD_REQUEST);

    product.quantity -= item.quantity;
  }

  // Save
  await product.save({ session });
};
