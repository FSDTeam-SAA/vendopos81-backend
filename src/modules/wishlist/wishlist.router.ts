import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import wishlistController from "./wishlist.controller";

const router = Router();

router.post("/add", auth(USER_ROLE.CUSTOMER), wishlistController.addToWishlist);

router.get(
  "/my-wishlist",
  auth(USER_ROLE.CUSTOMER),
  wishlistController.getMyWishlist
);

const wishlistRouter = router;
export default wishlistRouter;
