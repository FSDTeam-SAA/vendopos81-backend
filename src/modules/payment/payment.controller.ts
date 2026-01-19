import catchAsync from "../../utils/catchAsync";

const createPayment = catchAsync(async (req, res) => {});

const getAllPayments = catchAsync(async (req, res) => {});

const getSinglePayment = catchAsync(async (req, res) => {});

const paymentController = {
  createPayment,
  getAllPayments,
  getSinglePayment,
};

export default paymentController;
