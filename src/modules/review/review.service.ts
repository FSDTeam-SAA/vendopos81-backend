import AppError from "../../errors/AppError";
import Order from "../order/order.model";
import { User } from "../user/user.model";
import { IReview } from "./review.interface";
import Review from "./review.model";

const createReview = async (payload: IReview, email: string) => {
  const user = await User.findOne({ email });
  if (!user) throw new AppError("Your account does not exist", 404);

  const order = await Order.findOne({
    _id: payload.orderId,
    userId: user._id,
    status: "delivered",
  });

  if (!order) throw new AppError("You cannot review this product", 400);

  const existing = await Review.findOne({
    productId: payload.productId,
    orderId: payload.orderId,
    userId: user._id,
  });

  if (existing) throw new AppError("You have already reviewed this product", 400);

  return await Review.create({
    ...payload,
    userId: user._id,
  });
};

const reviewService = {
  createReview,
};

export default reviewService;
