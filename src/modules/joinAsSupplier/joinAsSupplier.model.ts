import { model, Schema } from "mongoose";
import { IJoinAsSupplier } from "./joinAsSupplier.interface";

const JoinAsSupplierSchema = new Schema<IJoinAsSupplier>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    shopName: { type: String, required: true },
    brandName: { type: String, required: true },
    shopSlug: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    reasonForRejection: { type: String },
    warehouseLocation: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    documentUrl: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
    rating: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const JoinAsSupplier = model<IJoinAsSupplier>(
  "JoinAsSupplier",
  JoinAsSupplierSchema
);
export default JoinAsSupplier;
