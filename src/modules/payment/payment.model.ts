import { model, Schema } from "mongoose";
import { IPayment } from "./payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    amount: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    customTransactionId: {
      type: String,
    },
  },
  { timestamps: true, versionKey: false },
);

const Payment = model<IPayment>("Payment", paymentSchema);

export default Payment;
