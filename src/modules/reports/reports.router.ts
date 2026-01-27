import { Router } from "express";
import reportsController from "./reports.controller";

const router = Router();

router.get("/top-buyers", reportsController.getTopBuyers);
router.get("/top-suppliers", reportsController.getTopSuppliers);

router.get("/:id", reportsController.getSingleTopRatedBuyer);


// router.get("/single-supplier/:id", reportsController.getSingleTopRatedSupplier)
const reportsRouter = router;
export default reportsRouter;
