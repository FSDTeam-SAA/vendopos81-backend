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
  const result = await productService.getMyAddedProducts(email, req.query);

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

const getAllWholeSaleProductForAdmin = catchAsync(async (req, res) => {
  const result = await productService.getAllWholeSaleProductForAdmin(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Wholesale products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getFeaturedProducts = catchAsync(async (req, res) => {
  const result = await productService.getFeaturedProducts();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Featured products retrieved successfully",
    data: result,
  });
});

const getFastMovingProducts = catchAsync(async (req, res) => {
  const result = await productService.getFastMovingProducts(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Fast moving products retrieved successfully",
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

const getFilterCategories = catchAsync(async (req, res) => {
  const result = await productService.getFilterCategories();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product filter categories retrieved successfully",
    data: result,
  });
});

const getTopRatedProducts = catchAsync(async (req, res) => {
  const result = await productService.getTopRatedProducts();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Top rated products retrieved successfully",
    data: result,
  });
});

const getCaseDealsProducts = catchAsync(async (req, res) => {
  const result = await productService.getCaseDealsProducts();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Case deals products retrieved successfully",
    data: result,
  });
});

const getRelatedProducts = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await productService.getRelatedProducts(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Related products retrieved successfully",
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

const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  await productService.deleteProduct(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product deleted successfully",
  });
});

const productController = {
  createProduct,
  getMyAddedProducts,
  getAllProducts,
  getAllWholeSaleProductForAdmin,
  getFastMovingProducts,
  getAllProductForAdmin,
  getFilterCategories,
  getFeaturedProducts,
  getSingleProduct,
  getTopRatedProducts,
  getCaseDealsProducts,
  getRelatedProducts,
  updateProductStatus,
  updateProduct,
  deleteProduct,
};

export default productController;
