import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import paymentService from "./payment.service";

const createPayment = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await paymentService.createPayment(req.body, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment created successfully",
    data: result,
  });
});

const stripeWebhookHandler = catchAsync(async (req, res) => {
  console.log("Stripe webhook received!"); // Check this log

  const sig = req.headers["stripe-signature"];
  const result = await paymentService.stripeWebhookHandler(sig, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Stripe webhook handled successfully",
    data: result,
  });
});

const getAllPayments = catchAsync(async (req, res) => {});

const getSinglePayment = catchAsync(async (req, res) => {});

const paymentController = {
  createPayment,
  stripeWebhookHandler,
  getAllPayments,
  getSinglePayment,
};

export default paymentController;
