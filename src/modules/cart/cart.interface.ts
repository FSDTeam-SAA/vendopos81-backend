import { Types } from "mongoose";

export interface ICart {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  wholesaleId?: Types.ObjectId;
  price: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}
