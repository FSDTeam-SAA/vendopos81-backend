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
  const { page, limit, orderStatus } = req.query;

  const result = await orderService.getMyOrders(email, {
    page,
    limit,
    orderStatus,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAllOrdersForAdmin = catchAsync(async (req, res) => {
  const result = await orderService.getAllOrdersForAdmin(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result.data,
    meta: result.meta,
    analytics: result.analytics,
  });
});

const getOrderFormSupplier = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await orderService.getOrderFormSupplier(email, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Orders retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await orderService.getSingleOrder(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Order retrieved successfully",
    data: result,
    // analytics: result.userSummary,
    recentOrders: result.recentOrders,
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

const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const result = await orderService.updateOrderStatus(id, status);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

const orderController = {
  createOrder,
  getMyOrders,
  getAllOrdersForAdmin,
  getOrderFormSupplier,
  getSingleOrder,
  cancelMyOrder,
  updateOrderStatus,
};

export default orderController;
