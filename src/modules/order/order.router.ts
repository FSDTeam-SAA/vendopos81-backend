import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import orderController from "./order.controller";

const router = Router();

router.post("/create", auth(USER_ROLE.CUSTOMER), orderController.createOrder);
router.get("/my-orders", auth(USER_ROLE.CUSTOMER), orderController.getMyOrders);

const orderRouter = router;
export default orderRouter;
