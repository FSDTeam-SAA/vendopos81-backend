import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { joinAsDriverService } from "./joinAsDriver.service";

const joinAsDriver = catchAsync(async (req, res) => {
  // 1. Correct the type casting to a Record/Object
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const { email } = req.user;

  // 2. Pass the files object as is to the service
  const result = await joinAsDriverService.joinAsDriver(email, req.body, files);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Driver application submitted",
    data: result,
  });
});

const getMyDriverInfo = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await joinAsDriverService.getMyDriverInfo(email);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    data: result,
  });
});

const updateDriverStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await joinAsDriverService.updateDriverStatus(id, status);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Status updated",
  });
});

const suspendDriver = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { days } = req.body; // Optional days for temporary suspension
  await joinAsDriverService.suspendDriver(id, days);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Suspension toggled",
  });
});

const getAllDrivers = catchAsync(async (req, res) => {
  const result = await joinAsDriverService.getAllDrivers(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Drivers retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleDriver = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await joinAsDriverService.getSingleDriver(id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Driver details retrieved",
    data: result,
  });
});

export const joinAsDriverController = {
  joinAsDriver,
  getMyDriverInfo,
  updateDriverStatus,
  suspendDriver,
  getAllDrivers,
  getSingleDriver,
  // ... include others similar to supplier
};
