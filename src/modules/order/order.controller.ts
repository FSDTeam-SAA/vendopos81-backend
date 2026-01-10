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

const getMyOrders = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await orderService.getMyOrders(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const getAllOrdersForAdmin = catchAsync(async (req, res) => {
  const result = await orderService.getAllOrdersForAdmin();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const getOrderFormSupplier = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await orderService.getOrderFormSupplier(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const cancelMyOrder = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const result = await orderService.cancelMyOrder(id, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Order cancelled successfully",
    data: result,
  });
});

const orderController = {
  createOrder,
  getMyOrders,
  getAllOrdersForAdmin,
  getOrderFormSupplier,
  cancelMyOrder,
};

export default orderController;
