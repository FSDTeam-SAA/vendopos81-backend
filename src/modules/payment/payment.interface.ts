import { Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  supplierId?: Types.ObjectId;
  paymentType: "ADMIN" | "SUPPLIER";
  adminCommission?: number;
  currency?: string;
  amount: number;
  status: "pending" | "success" | "failed";
  customTransactionId?: string;
  stripePaymentIntentId: string;
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}
