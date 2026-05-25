import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import paymentService from './payment.service';

const createPayment = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await paymentService.createPayment(req.body, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment created successfully',
    data: result,
  });
});

const stripeWebhookHandler = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  // Detailed logs for webhook debugging
  try {
    console.log('--- Stripe webhook received ---');
    console.log('URL:', req.originalUrl);
    console.log('Incoming webhook content-type:', req.get('content-type'));
    console.log('stripe-signature present:', Boolean(sig));
    // req.body may be Buffer (raw). Log length safely.
    if (req.body && typeof req.body.length === 'number') {
      console.log('Raw body length:', req.body.length);
    } else {
      console.log('Raw body type:', typeof req.body);
    }
  } catch (err) {
    console.error('Error while logging webhook request info:', err);
  }

  const result = await paymentService.stripeWebhookHandler(sig, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stripe webhook handled successfully',
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
    message: 'Payment transfer requested successfully',
    data: result,
  });
});

const getAllPayments = catchAsync(async (req, res) => {
  const result = await paymentService.getAllPayments(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payments retrieved successfully',
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
    message: 'Payment transferred successfully',
    data: result,
  });
});

const getSupplierPaymentHistory = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await paymentService.getSupplierPaymentHistory(email, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Supplier payment history retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const paymentController = {
  createPayment,
  stripeWebhookHandler,
  getAllPayments,
  requestForPaymentTransfer,
  transferPayment,
  getSupplierPaymentHistory,
};

export default paymentController;
