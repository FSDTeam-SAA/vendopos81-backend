import { Router } from "express";
import userRouter from "../modules/user/user.router";
import authRouter from "../modules/auth/auth.router";
import contactRouter from "../modules/contact/contact.router";
import subscriptionRouter from "../modules/subscription/subscription.router";
import joinAsSupplierRouter from "../modules/joinAsSupplier/joinAsSupplier.router";
import { joinAsDriverRouter } from "../modules/joinAsDriver/joinAsDriver.router";


const router = Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRouter,
  },
  {
    path: "/auth",
    route: authRouter,
  },
  {
    path: "/contact",
    route: contactRouter,
  },
  {
    path: "/subscription",
    route: subscriptionRouter,
  },
  {
    path: "/join-as-supplier",
    route: joinAsSupplierRouter,
  },{
    path: "/driver", 
    route: joinAsDriverRouter,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
