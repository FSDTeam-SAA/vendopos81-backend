import { Router } from "express";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constant";
import dashboardController from "./dashboard.controller";

const router = Router();

router.get(
  "/analytics",
  auth(USER_ROLE.ADMIN),
  dashboardController.adminDashboardAnalytics,
);

router.get("/revenue-charts", dashboardController.getRevenueCharts);

const dashboardRouter = router;
export default dashboardRouter;
