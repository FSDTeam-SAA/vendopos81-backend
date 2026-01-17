import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import orderController from "./order.controller";

const router = Router();

router.post("/create", auth(USER_ROLE.CUSTOMER), orderController.createOrder);
router.get("/my-orders", auth(USER_ROLE.CUSTOMER), orderController.getMyOrders);

router.get(
  "/all-orders",
  //   auth(USER_ROLE.ADMIN),
  orderController.getAllOrdersForAdmin
);

router.get(
  "/supplier-orders",
  auth(USER_ROLE.SUPPLIER),
  orderController.getOrderFormSupplier
);

router.put(
  "/cancel/:id",
  auth(USER_ROLE.CUSTOMER),
  orderController.cancelMyOrder
);

const orderRouter = router;
export default orderRouter;
