import { IReview } from "./review.interface";
import Review from "./review.model";

const createReview = async (payload: IReview, email: string) => {
  
};

const reviewService = {
  createReview,
};

export default reviewService;
