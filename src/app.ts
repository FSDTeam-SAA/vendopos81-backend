import cookieParser from "cookie-parser";
import corsModule from "cors";
import express, { Application } from "express";
import globalErrorHandler from "./middleware/globalErrorHandler";
import notFound from "./middleware/notFound";
import { applySecurity } from "./middleware/security";
import { connectedAccountWebhookHandler } from "./modules/accountWebHook";
import paymentController from "./modules/payment/payment.controller";
import router from "./router";

const app: Application = express();

// applySecurity(app);

// Stripe webhook route FIRST — must be raw body
app.post(
  "/api/v1/admin",
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhookHandler,
);

app.post(
  "/api/v1/onboard",
  express.raw({ type: "*/*" }),
  connectedAccountWebhookHandler,
);

// app.use(express.json());
app.use(express.static("public"));

app.use(corsModule());
app.use(cookieParser());

applySecurity(app);

app.use((req, res, next) => {
  if (
    req.originalUrl.startsWith("/api/v1/admin") ||
    req.originalUrl.startsWith("/api/v1/onboard")
  ) {
    // Skip JSON parsing, Stripe needs raw body
    return next();
  }
  express.json({ limit: "10mb" })(req, res, next);
});

app.use("/api/v1", router);

app.get("/", (_req, res) => {
  res.send("Hey there! Welcome to our API.");
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;

function cors(): any {
  throw new Error("Function not implemented.");
}
