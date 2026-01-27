import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import { User } from "../user/user.model";
import Notification from "./notification.model";

export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await Notification.updateMany(
    { isViewed: false },
    { isViewed: true },
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read successfully",
    data: result,
  });
});

export const getNotificationByCustomerId = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    // 1️⃣ ObjectId validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user id", httpStatus.BAD_REQUEST);
    }

    // 2️⃣ User check
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", httpStatus.NOT_FOUND);
    }

    // 3️⃣ Role validation (customer)
    if (user.role !== "customer") {
      throw new AppError("You are not a customer", httpStatus.FORBIDDEN);
    }

    // 4️⃣ Pagination (safe values)
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    // 5️⃣ Filter
    const filter = {
      to: userId,
    };

    // 6️⃣ Total count
    const total = await Notification.countDocuments(filter);

    // 7️⃣ Fetch notifications
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notifications fetched successfully",
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: notifications,
    });
  },
);

export const getNotificationBySupplierId = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    // 1️⃣ ObjectId validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user id", httpStatus.BAD_REQUEST);
    }

    // 2️⃣ User check
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", httpStatus.NOT_FOUND);
    }

    // 3️⃣ Role validation
    if (user.role !== "supplier") {
      throw new AppError("You are not a supplier", httpStatus.FORBIDDEN);
    }

    // 4️⃣ Supplier account check
    const supplier = await JoinAsSupplier.findOne({ userId: user._id });
    if (!supplier) {
      throw new AppError("Supplier profile not found", httpStatus.NOT_FOUND);
    }

    if (supplier.isSuspended) {
      throw new AppError(
        "Your supplier account is suspended",
        httpStatus.FORBIDDEN,
      );
    }

    // 5️⃣ Pagination
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const filter = { to: userId };

    // 6️⃣ Count + fetch
    const total = await Notification.countDocuments(filter);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notifications fetched successfully",
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: notifications,
    });
  },
);

export const getNotificationByAdminId = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    // 1️⃣ ObjectId validation
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user id", httpStatus.BAD_REQUEST);
    }

    // 2️⃣ User check
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", httpStatus.NOT_FOUND);
    }

    // 3️⃣ Role validation
    if (user.role !== "admin") {
      throw new AppError("You are not an admin", httpStatus.FORBIDDEN);
    }

    // 4️⃣ Pagination (safe)
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    // 5️⃣ Filter
    const filter = {
      to: userId,
    };

    // 6️⃣ Count + fetch
    const total = await Notification.countDocuments(filter);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notifications fetched successfully",
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
      data: notifications,
    });
  },
);

// export const getAllNotifications = catchAsync(
//   async (req: Request, res: Response) => {
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const total = await Notification.countDocuments();
//     const notifications = await Notification.find()
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     sendResponse(res, {
//       statusCode: httpStatus.OK,
//       success: true,
//       message: "Notifications fetched successfully",
//       meta: {
//         page,
//         limit,
//         totalPage: Math.ceil(total / limit),
//         total,
//       },
//       data: notifications,
//     });
//   },
// );
