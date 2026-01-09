import { StatusCodes } from "http-status-codes";
import mongoose, { Types } from "mongoose";
import AppError from "../errors/AppError";
import Product from "../modules/product/product.model";
import Wholesale from "../modules/wholeSale/wholeSale.model";

export const decreaseInventory = async (
  item: {
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    wholesaleId?: Types.ObjectId;
    quantity: number;
  },
  session: mongoose.ClientSession
) => {
  // 1️⃣ Fetch product
  const product: any = await Product.findById(item.productId).session(session);
  if (!product) throw new AppError("Product not found", StatusCodes.NOT_FOUND);

  /**
   * ================= VARIANT =================
   */
  if (item.variantId) {
    const variant = product.variants?.find(
      (v: any) => v._id.toString() === item.variantId!.toString()
    );

    if (!variant)
      throw new AppError("Variant not found", StatusCodes.BAD_REQUEST);

    if (variant.stock < item.quantity)
      throw new AppError("Not enough variant stock", StatusCodes.BAD_REQUEST);

    variant.stock -= item.quantity;

    await product.save({ session });
    return;
  }

  /**
   * ================= WHOLESALE =================
   */
  if (item.wholesaleId) {
    const wholesale: any = await Wholesale.findById(item.wholesaleId).session(
      session
    );

    if (!wholesale)
      throw new AppError("Wholesale not found", StatusCodes.BAD_REQUEST);

    // ===== CASE =====
    if (wholesale.type === "case") {
      const caseItem = wholesale.caseItems?.find(
        (c: any) => c.productId.toString() === item.productId.toString()
      );

      if (!caseItem)
        throw new AppError("Case item not found", StatusCodes.BAD_REQUEST);

      if (caseItem.quantity < item.quantity)
        throw new AppError("Not enough case stock", StatusCodes.BAD_REQUEST);

      caseItem.quantity -= item.quantity;

      wholesale.markModified("caseItems");
      await wholesale.save({ session });
      return;
    }

    // ===== PALLET =====
    if (wholesale.type === "pallet") {
      const pallet = wholesale.palletItems?.[0];
      if (!pallet)
        throw new AppError("Pallet not found", StatusCodes.BAD_REQUEST);

      const palletItem = pallet.items?.find(
        (i: any) => i.productId.toString() === item.productId.toString()
      );

      if (!palletItem)
        throw new AppError(
          "Product not found in pallet",
          StatusCodes.BAD_REQUEST
        );

      if (palletItem.caseQuantity < item.quantity)
        throw new AppError("Not enough pallet stock", StatusCodes.BAD_REQUEST);

      // ✅ product-wise stock
      palletItem.caseQuantity -= item.quantity;

      // optional summary
      pallet.totalCases -= item.quantity;

      wholesale.markModified("palletItems");
      await wholesale.save({ session });
      return;
    }
  }

  /**
   * ================= NORMAL PRODUCT =================
   */
  if (product.quantity == null)
    throw new AppError("Product stock not defined", StatusCodes.BAD_REQUEST);

  if (product.quantity < item.quantity)
    throw new AppError("Not enough stock", StatusCodes.BAD_REQUEST);

  product.quantity -= item.quantity;
  await product.save({ session });
};
