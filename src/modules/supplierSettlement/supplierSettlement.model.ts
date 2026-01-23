import { Schema, model } from "mongoose";
import { ISupplierSettlement } from "./supplierSettlement.interface";

const supplierSettlementSchema = new Schema<ISupplierSettlement>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    adminCommission: {
      type: Number,
      required: true,
    },
    payableAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "transferred"],
      default: "pending",
    },
    transferredAt: Date,
  },
  { timestamps: true, versionKey: false },
);

export const SupplierSettlement = model(
  "SupplierSettlement",
  supplierSettlementSchema,
);
