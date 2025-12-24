import catchAsync from "../../utils/catchAsync";
import { Request, Response } from "express";
import subscriptionService from "./subscription.service";
import sendResponse from "../../utils/sendResponse";
import { StatusCodes } from "http-status-codes";




const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  await subscriptionService.createSubscription(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Thank you for the subscription"
  });
});

const subscriptionController = {
  createSubscription,
};

export default subscriptionController;

