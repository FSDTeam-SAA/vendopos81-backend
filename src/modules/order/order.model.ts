import { model, Schema } from "mongoose";
import { IOrder } from "./order.interface";

const orderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "JoinAsSupplier",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    wholesaleId: {
      type: Schema.Types.ObjectId,
      ref: "Wholesale",
    },
    unitPrice: {
      type: Number,
      // required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderUniqueId: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    orderType: {
      type: String,
      enum: ["single", "addToCart"],
      required: true,
    },
    paymentType: {
      type: String,
      enum: ["online", "cod"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed"],
      default: "unpaid",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "delivered", "cancelled"],
      default: "pending",
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items: any[]) {
          return items.length > 0;
        },
        message: "Order must contain at least one item",
      },
    },
    totalPrice: {
      type: Number,
      // required: true,
      min: 0,
    },
    billingInfo: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

orderSchema.pre("validate", async function (next) {
  const doc = this as any;
  if (doc.orderUniqueId) {
    return next();
  }

  const OrderModel = doc.constructor as any;

  const lastOrder = await OrderModel.findOne(
    { orderUniqueId: { $exists: true } },
    { orderUniqueId: 1 }
  )
    .sort({ createdAt: -1 })
    .lean();

  let lastNumber = 1000;

  if (lastOrder?.orderUniqueId) {
    const num = Number(lastOrder.orderUniqueId.split("-")[1]);
    if (!isNaN(num)) lastNumber = num;
  }

  doc.orderUniqueId = `ORD-${lastNumber + 1}`;

  next();
});

const Order = model<IOrder>("Order", orderSchema);

export default Order;
