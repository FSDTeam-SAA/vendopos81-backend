import fs from "fs";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import PDFDocument from "pdfkit";
import Stripe from "stripe";
import AppError from "../errors/AppError";
import Order from "../modules/order/order.model";
import Payment from "../modules/payment/payment.model";
import { User } from "../modules/user/user.model";

export const groupItemsBySupplier = (items: any[]) => {
  const map: Record<string, any[]> = {};
  for (const item of items) {
    const supplierId = item.supplierId.toString();
    if (!map[supplierId]) map[supplierId] = [];
    map[supplierId].push(item);
  }
  return map;
};

export const calculateAmounts = (items: any[]) => {
  let total = 0;
  for (const item of items) {
    total += item.unitPrice * item.quantity;
  }
  const adminCommission = Math.round(total * 0.25);
  const supplierAmount = total - adminCommission;
  return { total, adminCommission, supplierAmount };
};

export const splitItemsByOwner = (items: any[]) => {
  const supplierMap: Record<string, any[]> = {};
  const adminItems: any[] = [];

  for (const item of items) {
    if (item.supplierId) {
      const supplierId = item.supplierId.toString();
      if (!supplierMap[supplierId]) supplierMap[supplierId] = [];
      supplierMap[supplierId].push(item);
    } else {
      // ✅ Admin product
      adminItems.push(item);
    }
  }

  return { supplierMap, adminItems };
};

export const calculateTotal = (items: any[]) => {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
};

export const handlePaymentSuccess = async (
  session: Stripe.Checkout.Session,
): Promise<any | null> => {
  const payment = await Payment.findOne({
    stripePaymentIntentId: session.payment_intent as string,
  });

  if (!payment) return null;

  // payment.status = "success";
  // await payment.save();

  await Payment.findByIdAndUpdate(payment._id, { status: "success" });

  // Update order status
  await updateOrderStatus(payment.orderId, payment.userId);

  return payment;
};

export const updateOrderStatus = async (
  orderId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
) => {
  const payments = await Payment.find({ orderId, userId });
  const allPaid = payments.every((p) => p.status === "success");

  if (allPaid) {
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "paid",
    });
    //! There are too many validations will be added.
  }
};

export const notifySupplierAndAdmin = async (payment: any) => {
  const supplier = await User.findById(payment.supplierId);
  const admin = await User.findOne({ role: "admin" });

  if (supplier) {
    console.log(
      `Supplier ${supplier.firstName} received payment: $${payment.amount}`,
    );
    // sendEmail(supplier.email, "Payment Received", ...)
  }

  if (admin) {
    console.log(`Admin received commission: $${payment.adminCommission}`);
    // sendEmail(admin.email, "Commission Received", ...)
  }
};

export const generateInvoice = async (orderId: Types.ObjectId | string) => {
  const order = await Order.findById(orderId).populate("items.productId");

  if (!order) throw new AppError("Order not found", StatusCodes.NOT_FOUND);

  const payments = await Payment.find({ orderId });

  const doc = new PDFDocument();
  const path = `invoices/invoice-${order.orderUniqueId}.pdf`;
  doc.pipe(fs.createWriteStream(path));

  doc.fontSize(16).text(`Invoice for Order: ${order.orderUniqueId}`);
  doc.moveDown();
  doc.fontSize(12).text(`Buyer: ${order.billingInfo.name}`);
  doc.moveDown();
  doc.text("Items:");

  order.items.forEach((item: any) => {
    doc.text(`${item.productId.title} x ${item.quantity} - $${item.unitPrice}`);
  });

  doc.moveDown();
  payments.forEach((p: any) => {
    doc.text(
      `Supplier Payment: $${p.amount}, Admin Commission: $${p.adminCommission}`,
    );
  });

  doc.moveDown();
  doc.text(`Total: $${order.totalPrice}`);

  doc.end();

  return path;
};
