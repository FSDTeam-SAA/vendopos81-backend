import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import cartService from "./cart.service";

const addToCart = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await cartService.addToCart(email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product added to cart successfully",
    data: result,
  });
});

const getMyCart = catchAsync(async (req, res) => {
  const { email } = req.user;

  // ✅ pagination query
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await cartService.getMyCart(email, page, limit);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Cart retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const increaseProductQuantity = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const { quantity } = req.body;
  const result = await cartService.increaseProductQuantity(email, quantity, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product quantity increased successfully",
    data: result,
  });
});

const decreaseProductQuantity = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const { quantity } = req.body;
  const result = await cartService.decreaseProductQuantity(email, quantity, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product quantity decreased successfully",
    data: result,
  });
});

const cartController = {
  addToCart,
  getMyCart,
  increaseProductQuantity,
  decreaseProductQuantity,
};

export default cartController;
