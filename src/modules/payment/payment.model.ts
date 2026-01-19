import { model, Schema } from "mongoose";
import Counter from "./counter.model";
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

paymentSchema.pre("save", async function (next) {
  if (this.customTransactionId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "paymentTxn" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  this.customTransactionId = `TXN-${counter.seq}`;
  next();
});

const Payment = model<IPayment>("Payment", paymentSchema);

export default Payment;
