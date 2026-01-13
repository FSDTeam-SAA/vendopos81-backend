import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import reviewController from "./review.controller";

const router = Router();

router.post(
  "/add-review",
  auth(USER_ROLE.CUSTOMER),
  reviewController.createReview
);

router.get("/all", reviewController.getAllReviews);
router.get("/:id", reviewController.getSingleReview);

router.put(
  "/update/:id",
  //   auth(USER_ROLE.CUSTOMER),
  reviewController.updateReviewStatus
);

const reviewRouter = router;
export default reviewRouter;
