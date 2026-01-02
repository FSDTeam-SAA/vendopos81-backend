import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import wishlistService from "./wishlist.service";

const addToWishlist = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { productId } = req.body;
  const result = await wishlistService.addToWishlist(email, productId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product added to wishlist successfully",
    data: result,
  });
});

const getMyWishlist = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await wishlistService.getMyWishlist(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Wishlist retrieved successfully",
    data: result,
  });
});

const deletedFromWishlist = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  await wishlistService.deletedFromWishlist(email, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product deleted from wishlist successfully",
  });
});

const wishlistController = {
  addToWishlist,
  getMyWishlist,
  deletedFromWishlist,
};

export default wishlistController;
