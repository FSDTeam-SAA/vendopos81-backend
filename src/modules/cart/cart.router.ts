import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import cartController from "./cart.controller";

const router = Router();

router.post("/add-cart", auth(USER_ROLE.CUSTOMER), cartController.addToCart);

const cartRouter = router;
export default cartRouter;
