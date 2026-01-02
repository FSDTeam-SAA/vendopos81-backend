import { Types } from "mongoose";

export interface ICart {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: number;
  price: number;
}
