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

const dashboardController = {
  adminDashboardAnalytics,
  getRevenueCharts,
  getRegionalSales,
};

export default dashboardController;
