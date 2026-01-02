import { Router } from "express";
import authRouter from "../modules/auth/auth.router";
import categoryRouter from "../modules/category/category.router";
import contactRouter from "../modules/contact/contact.router";
import joinAsDriverRouter from "../modules/joinAsDriver/joinAsDriver.router";
import joinAsSupplierRouter from "../modules/joinAsSupplier/joinAsSupplier.router";
import productRouter from "../modules/product/product.router";
import subscriptionRouter from "../modules/subscription/subscription.router";
import userRouter from "../modules/user/user.router";
import wholeSaleRouter from "../modules/wholeSale/wholeSale.router";
import wishlistRouter from "../modules/wishlist/wishlist.router";
import cartRouter from "../modules/cart/cart.router";

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
  },
  {
    path: "/admin/driver", // This handles all your admin-prefixed requests
    route: joinAsDriverRouter,
  },
  {
    path: "/driver",
    route: joinAsDriverRouter,
  },
  {
    path: "/product",
    route: productRouter,
  },
  {
    path: "/category",
    route: categoryRouter,
  },
  {
    path: "/whole-sale",
    route: wholeSaleRouter,
  },
  {
    path: "/wishlist",
    route: wishlistRouter,
  },
  {
    path: "/cart",
    route: cartRouter,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
