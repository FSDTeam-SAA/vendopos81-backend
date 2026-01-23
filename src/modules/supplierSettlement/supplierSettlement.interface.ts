import { Types } from "mongoose";

export interface ISupplierSettlement {
  orderId: Types.ObjectId | string;
  supplierId: Types.ObjectId | string;
  paymentId?: Types.ObjectId;
  totalAmount: number;
  adminCommission: number;
  payableAmount: number;
  status: "pending" | "transferred";
  transferredAt: Date;
}
