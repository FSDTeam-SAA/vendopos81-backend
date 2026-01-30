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
  const sig = req.headers["stripe-signature"];
  const result = await paymentService.stripeWebhookHandler(sig, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Stripe webhook handled successfully",
    data: result,
  });
});

const requestForPaymentTransfer = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { email } = req.user;
  const result = await paymentService.requestForPaymentTransfer(email, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment transfer requested successfully",
    data: result,
  });
});

const getAllPayments = catchAsync(async (req, res) => {
  const result = await paymentService.getAllPayments(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payments retrieved successfully",
    data: result.data,
    meta: result.meta,
    analytics: result.summary,
  });
});

const transferPayment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await paymentService.transferPayment(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Payment transferred successfully",
    data: result,
  });
});

const paymentController = {
  createPayment,
  stripeWebhookHandler,
  getAllPayments,
  requestForPaymentTransfer,
  transferPayment,
};

export default paymentController;
