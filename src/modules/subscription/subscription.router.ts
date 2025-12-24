import { Router } from "express";
import subscriptionController from "./subscription.controller";

const router = Router();

router.post("/create", subscriptionController.createSubscription);


const subscriptionRouter = router;
export default subscriptionRouter;
