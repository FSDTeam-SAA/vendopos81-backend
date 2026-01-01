import { Types } from "mongoose";

export interface IWholeSale {
  productId: Types.ObjectId;
  categoryType: "case" | "pallet" 
  quantity: number;
  setPrice?: number;
  customPrice?: number;
  discount?: string;
  isActive?: boolean;
}
