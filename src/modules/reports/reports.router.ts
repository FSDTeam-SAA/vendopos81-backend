import { Router } from "express";
import reportsController from "./reports.controller";

const router = Router();

router.get("/top-buyers", reportsController.getTopBuyers);
router.get("/top-suppliers", reportsController.getTopSuppliers);
router.get("/top-products", reportsController.getTopRatedProducts);

router.get("/:id", reportsController.getSingleTopRatedBuyer);

const reportsRouter = router;
export default reportsRouter;
