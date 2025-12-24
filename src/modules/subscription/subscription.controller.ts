import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import subscriptionService from "./subscription.service";

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  await subscriptionService.createSubscription(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Thank you for the subscription",
  });
});

const subscriptionController = {
  createSubscription,
};

export default subscriptionController;
