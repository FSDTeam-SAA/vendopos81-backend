import { Router } from "express";
import subscriptionController from "./subscription.controller";

const router = Router();

router.post("/create", subscriptionController.createSubscription);
router.get("/get-all-subscription", subscriptionController.getAllSubscription);
router.delete("/delete-subscription/:id", subscriptionController.deleteSubcription);


const subscriptionRouter = router;
export default subscriptionRouter;


