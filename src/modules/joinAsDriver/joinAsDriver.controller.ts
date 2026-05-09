import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { joinAsDriverService } from './joinAsDriver.service';

const updateMyProfile = catchAsync(async (req, res) => {
  const { id } = req.user; // This is the userId from the JWT
  const data = req.body;

  const result = await joinAsDriverService.updateMyProfileInDB(id, data);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

const getMyDriverInfo = catchAsync(async (req, res) => {
  // Extract 'id' attached by the auth middleware from the decoded JWT
  const { id } = req.user;

  const result = await joinAsDriverService.getMyDriverInfoFromDB(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Driver profile retrieved successfully',
    data: result,
  });
});

const updateDriverStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Expecting "approved" or "rejected"

  const result = await joinAsDriverService.updateDriverStatus(id, status);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Driver application ${status} successfully`,
    data: result,
  });
});

const suspendDriver = catchAsync(async (req, res) => {
  const { id } = req.params;
  await joinAsDriverService.suspendDriver(id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Suspension toggled',
  });
});

const unsuspendDriver = catchAsync(async (req, res) => {
  const { id } = req.params;
  await joinAsDriverService.unsuspendDriver(id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Unsuspension toggled',
  });
});

const getAllDrivers = catchAsync(async (req, res) => {
  const result = await joinAsDriverService.getAllDrivers(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Drivers retrieved successfully',
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
    message: 'Driver details retrieved',
    data: result,
  });
});

const deleteDriver = catchAsync(async (req, res) => {
  const { id } = req.params;
  await joinAsDriverService.deleteDriver(id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Driver deleted successfully',
  });
});

const registerDriverUnified = catchAsync(async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  // req.user is populated by optionalAuth, otherwise it is undefined
  const result = await joinAsDriverService.registerDriverUnified(req.body, files, req.user);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Application submitted successfully',
    data: result,
  });
});

const approveDriverApplication = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await joinAsDriverService.approveDriverApplication(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Driver approved and role updated successfully!',
    data: result,
  });
});

export const joinAsDriverController = {
  getMyDriverInfo,
  updateDriverStatus,
  suspendDriver,
  unsuspendDriver,
  getAllDrivers,
  getSingleDriver,
  deleteDriver,
  registerDriverUnified,
  updateMyProfile,
  approveDriverApplication,
};
