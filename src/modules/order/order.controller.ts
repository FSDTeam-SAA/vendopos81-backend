import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import orderService from "./order.service";

const createOrder = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await orderService.createOrder(req.body, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Your order has been created successfully.",
    data: result,
  });
});

const orderController = {
  createOrder,
};

export default orderController;
