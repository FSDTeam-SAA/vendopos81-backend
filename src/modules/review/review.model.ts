import { model, Schema } from "mongoose";
import { IReview } from "./review.interface";

const reviewModel = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      //   required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      //   required: true,
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
  },
  { timestamps: true, versionKey: false }
);

const Review = model<IReview>("Review", reviewModel);

export default Review;
