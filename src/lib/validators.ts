import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import AppError from "../errors/AppError";
import JoinAsSupplier from "../modules/joinAsSupplier/joinAsSupplier.model";
import Order from "../modules/order/order.model";
import { User } from "../modules/user/user.model";

export const validateUser = async (email: string) => {
  const user = await User.findOne({ email });

  if (!user) throw new AppError("Account not found", StatusCodes.NOT_FOUND);

  if (!user.isVerified)
    throw new AppError("Please verify your account", StatusCodes.FORBIDDEN);

  if (user.isSuspended)
    throw new AppError("Account suspended", StatusCodes.FORBIDDEN);

  return user;
};

export const validateOrderForPayment = async (
  orderId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
) => {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new AppError("Order not found", StatusCodes.NOT_FOUND);

  if (order.paymentStatus === "paid")
    throw new AppError("Order already paid", StatusCodes.CONFLICT);

  return order;
};

export const validateSupplierForPayment = async (supplierUserId: string) => {
  const supplier = await JoinAsSupplier.findOne({ _id: supplierUserId });

  if (!supplier)
    throw new AppError("Supplier not found", StatusCodes.BAD_REQUEST);

  if (supplier.status !== "approved")
    throw new AppError("Supplier not approved", StatusCodes.BAD_REQUEST);

  if (supplier.isSuspended === true)
    throw new AppError("Supplier account suspended", StatusCodes.BAD_REQUEST);

  const supplierUser = await User.findById(supplier.userId);
  if (!supplierUser)
    throw new AppError("Supplier account not found", StatusCodes.BAD_REQUEST);

  if (!supplierUser.stripeOnboardingCompleted)
    throw new AppError(
      "Supplier not ready for receiving payments",
      StatusCodes.BAD_REQUEST,
    );

  if (!supplierUser.stripeAccountId)
    throw new AppError(
      "Supplier not connected with Stripe",
      StatusCodes.BAD_REQUEST,
    );

  return supplierUser;
};


export const getOrderOwnership = (product: any) => {
  if (product.addBy === "admin") {
    return {
      userId: product.userId, // ✅ ADMIN ID
    };
  }

  return {
    supplierId: product.supplierId,
  };
};
