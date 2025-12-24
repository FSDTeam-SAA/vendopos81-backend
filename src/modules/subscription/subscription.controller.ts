import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import subscriptionService from "./subscription.service";
import AppError from "../../errors/AppError";

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  await subscriptionService.createSubscription(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Thank you for the subscription",
  });
});

const getAllSubscription = catchAsync(async (req: Request, res: Response) => {
    const result = await subscriptionService.getAllSubscriptionFromDb();
  
  
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscriptions retrieved successfully.",
    data: result,
  })});


const deleteSubcription = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await subscriptionService.deleteSubcriptionFromDb(id);

  if(!result) {
    throw new AppError("Subscription not found", StatusCodes.NOT_FOUND);
  }

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subscription deleted successfully.",
    data: result,
  });
})

const subscriptionController = {
  createSubscription,
  getAllSubscription,
  deleteSubcription
};

export default subscriptionController;
