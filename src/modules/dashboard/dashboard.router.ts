import { Router } from "express";
import dashboardController from "./dashboard.controller";

const router = Router();

router.get("/analytics", dashboardController.adminDashboardAnalytics);

const dashboardRouter = router;
export default dashboardRouter;
