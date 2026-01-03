import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import cartController from "./cart.controller";

const router = Router();

router.post("/add-cart", auth(USER_ROLE.CUSTOMER), cartController.addToCart);

router.get("/my-cart", auth(USER_ROLE.CUSTOMER), cartController.getMyCart);

router.put(
  "/increase-quantity/:id",
  auth(USER_ROLE.CUSTOMER),
  cartController.increaseProductQuantity
);

router.put(
  "/decrease-quantity/:id",
  auth(USER_ROLE.CUSTOMER),
  cartController.decreaseProductQuantity
);

router.delete(
  "/remove-product/:id",
  auth(USER_ROLE.CUSTOMER),
  cartController.removeProductFromCart
);

const cartRouter = router;
export default cartRouter;
