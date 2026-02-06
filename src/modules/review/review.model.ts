import { model, Schema } from "mongoose";
import { IReview } from "./review.interface";

const reviewModel = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isReviewAdded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, versionKey: false },
);

const Review = model<IReview>("Review", reviewModel);

export default Review;
