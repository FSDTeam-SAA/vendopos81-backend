import { model, Schema } from "mongoose";
import Counter from "./counter.model";
import { IPayment } from "./payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    // supplierId: {
    //   type: Schema.Types.ObjectId,
    //   ref: "JoinAsSupplier",
    //   default: null,
    // },
    amount: {
      type: Number,
      required: true,
    },
    // adminCommission: {
    //   type: Number,
    //   default: 0,
    // },
    // supplierCommission: {
    //   type: Number,
    //   default: 0,
    // },
    currency: {
      type: String,
      default: "cad",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    // paymentTransferStatus: {
    //   type: String,
    //   enum: ["requested", "pending", "transferred"],
    //   default: "pending",
    // },
    customTransactionId: {
      type: String,
    },
    stripeCheckoutSessionId: {
      type: String,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      index: true,
    },
    paymentDate: {
      type: Date,
    },
    // paymentTransferDate: {
    //   type: Date,
    // },
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
