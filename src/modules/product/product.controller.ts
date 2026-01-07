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

const getAllProducts = catchAsync(async (req, res) => {
  const result = await productService.getAllProducts(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getAllProductForAdmin = catchAsync(async (req, res) => {
  const result = await productService.getAllProductForAdmin(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await productService.getSingleProduct(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const updateProductStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await productService.updateProductStatus(id, status);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product status updated successfully",
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { email } = req.user;
  const files = req.files as Express.Multer.File[];

  const result = await productService.updateProduct(id, req.body, files, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

const productController = {
  createProduct,
  getMyAddedProducts,
  getAllProducts,
  getAllProductForAdmin,
  getSingleProduct,
  updateProductStatus,
  updateProduct,
};

export default productController;
