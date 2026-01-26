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
  const result = await dashboardService.getRevenueCharts();

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
};

export default dashboardController;
