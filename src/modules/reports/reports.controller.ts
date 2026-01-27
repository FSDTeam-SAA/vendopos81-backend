import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import reportsService from "./reports.service";

const getTopBuyers = catchAsync(async (req, res) => {
  const result = await reportsService.getTopBuyers();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Top Buyers retrieved successfully",
    data: result,
  });
});

const getSingleTopRatedBuyer = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await reportsService.getSingleTopRatedBuyer(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Top Buyer retrieved successfully",
    data: result,
  });
});

const getTopSuppliers = catchAsync(async (req, res) => {
  const result = await reportsService.getTopSuppliers();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Top Suppliers retrieved successfully",
    data: result,
  });
});

const getTopRatedProducts = catchAsync(async (req, res) => {
  const result = await reportsService.getTopRatedProducts();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Top Rated Products retrieved successfully",
    data: result,
  });
});

const reportsController = {
  getTopBuyers,
  getSingleTopRatedBuyer,
  getTopSuppliers,
  getTopRatedProducts,
};

export default reportsController;
