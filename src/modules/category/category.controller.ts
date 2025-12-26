import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import categoryService from "./category.service";

const createCategory = catchAsync(async (req, res) => {
  const result = await categoryService.createCategory(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "New category created successfully",
    data: result,
  });
});

const getCategories = catchAsync(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await categoryService.getCategories(page, limit);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All categories retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await categoryService.updateCategory(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const categoryController = {
  createCategory,
  getCategories,
  updateCategory,
};

export default categoryController;
