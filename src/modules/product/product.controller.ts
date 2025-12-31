import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import productService from "./product.service";

const createProduct = catchAsync(async (req, res) => {
  const { email } = req.user;
  const files = req.files as Express.Multer.File[];

  const result = await productService.createProduct(req.body, files, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getMyAddedProducts = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await productService.getMyAddedProducts(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Products retrieved successfully",
    data: result,
  });
});

const productController = {
  createProduct,
  getMyAddedProducts,
};

export default productController;
