import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import dashboardService from "./dashboard.service";

const adminDashboardAnalytics = catchAsync(async (req, res) => {
  const result = await dashboardService.adminDashboardAnalytics();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dashboard analytics fetched successfully",
    data: result,
  });
});

const getRevenueCharts = catchAsync(async (req, res) => {
  const type = req.query.type || "revenue";
  const year = Number(req.query.year);
  const result = await dashboardService.getDashboardCharts(type as any, year);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dashboard analytics fetched successfully",
    data: result,
  });
});

const getRegionalSales = catchAsync(async (req, res) => {
  const result = await dashboardService.getRegionalSales();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dashboard analytics fetched successfully",
    data: result,
  });
});

const getSupplierAnalytics = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await dashboardService.getSupplierAnalytics(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dashboard analytics fetched successfully",
    data: result,
  });
});

const getSupplierSalesProductCharts = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { year } = req.query;

  const result = await dashboardService.getSupplierSalesProductCharts(
    email,
    year ? Number(year) : undefined,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dashboard analytics fetched successfully",
    data: result,
  });
});


const dashboardController = {
  adminDashboardAnalytics,
  getRevenueCharts,
  getRegionalSales,
  getSupplierAnalytics,
  getSupplierSalesProductCharts,
};

export default dashboardController;
