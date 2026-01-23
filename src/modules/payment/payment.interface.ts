import { Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  supplierId?: Types.ObjectId;
  adminCommission?: number;
  currency?: string;
  amount: number;
  status: "pending" | "success" | "failed";
  customTransactionId?: string;
  stripePaymentIntentId: string;
  createdAt: Date;
  updatedAt: Date;
}
