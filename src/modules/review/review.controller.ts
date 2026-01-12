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

const reviewController = {
  createReview,
};

export default reviewController;
