import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import onboardService from "./onboard.service";

const createOnboard = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await onboardService.createConnectedAccount(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Account created successfully",
    data: result,
  });
});

const getStripeLoginLink = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await onboardService.getStripeLoginLink(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Login link retrieved successfully",
    data: result,
  });
});

const onboardController = {
  createOnboard,
  getStripeLoginLink,
};

export default onboardController;
