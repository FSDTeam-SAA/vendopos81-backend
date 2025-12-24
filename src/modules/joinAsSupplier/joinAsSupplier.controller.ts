import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import joinAsSupplierService from "./joinAsSupplier.service";

const joinAsSupplier = catchAsync(async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const { email } = req.user;
  const result = await joinAsSupplierService.joinAsSupplier(
    email,
    req.body,
    files
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Successfully joined as supplier",
    data: result,
  });
});

const getMySupplierInfo = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await joinAsSupplierService.getMySupplierInfo(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Supplier information retrieved successfully",
    data: result,
  });
});

const getAllSuppliers = catchAsync(async (req, res) => {
  const result = await joinAsSupplierService.getAllSuppliers(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "All suppliers retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getSingleSupplier = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await joinAsSupplierService.getSingleSupplier(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Supplier retrieved successfully",
    data: result,
  });
});

const updateSupplierStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await joinAsSupplierService.updateSupplierStatus(id, status);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Supplier status updated successfully",
    // data: result,
  });
});

const suspendSupplier = catchAsync(async (req, res) => {
  const { id } = req.params;
  await joinAsSupplierService.suspendSupplier(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Supplier toggle status successfully`,
  });
});

const deleteSupplier = catchAsync(async (req, res) => {
  const { id } = req.params;
  await joinAsSupplierService.deleteSupplier(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Supplier deleted successfully`,
  });
});

const joinAsSupplierController = {
  joinAsSupplier,
  getMySupplierInfo,
  getAllSuppliers,
  updateSupplierStatus,
  getSingleSupplier,
  suspendSupplier,
  deleteSupplier,
};

export default joinAsSupplierController;
