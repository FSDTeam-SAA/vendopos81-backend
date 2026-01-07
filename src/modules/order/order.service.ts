import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import { User } from "../user/user.model";
import { IOrder } from "./order.interface";

const createOrder = async (payload: IOrder, email: string) => {
  const user = await User.findOne({ email });
  if (!user)
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);

//   if(type.orderType === "addToCart"){

//   }


};

const orderService = {
  createOrder,
};

export default orderService;
