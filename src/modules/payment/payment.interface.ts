import { Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  amount: number;
  status: "pending" | "success" | "failed";
  customTransactionId?: string;
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}
