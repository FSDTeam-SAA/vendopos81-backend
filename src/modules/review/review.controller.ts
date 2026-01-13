import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import reviewService from "./review.service";

const createReview = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await reviewService.createReview(req.body, email);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Review created successfully",
    data: result,
  });
});

const getAllReviews = catchAsync(async (req, res) => {
  const result = await reviewService.getAllReviews(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All reviews retrieved successfully",
    data: result.data,
    analytics: result.analytics,
    meta: result.meta,
  });
});

const getSingleReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await reviewService.getSingleReview(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review retrieved successfully",
    data: result,
  });
});

const updateReviewStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await reviewService.updateReviewStatus(id, status);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review status updated successfully",
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  await reviewService.deleteReview(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review deleted successfully",
  });
});

const reviewController = {
  createReview,
  getAllReviews,
  getSingleReview,
  updateReviewStatus,
  deleteReview,
};

export default reviewController;
