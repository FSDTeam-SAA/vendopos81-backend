import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import cartService from "./cart.service";

const addToCart = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { productId } = req.body;
  const result = await cartService.addToCart(email, productId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product added to cart successfully",
    data: result,
  });
});

const getMyCart = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await cartService.getMyCart(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Cart retrieved successfully",
    data: result,
  });
});

const cartController = {
  addToCart,
  getMyCart,
};

export default cartController;
