import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/AppError";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import Order from "../order/order.model";
import { User } from "../user/user.model";
import { SupplierSettlement } from "./supplierSettlement.model";

interface ISettlementQuery {
  page?: number;
  limit?: number;
  status?: "pending" | "transferred" | "requested";
}

const getAllSupplierSettlements = async (query: ISettlementQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (query.status) {
    filter.status = query.status;
  }

  // 🔹 Settlement List (with pagination)
  const settlements = await SupplierSettlement.find(filter)
    .populate({
      path: "orderId",
      model: Order,
      select: "orderNumber totalAmount orderStatus paymentStatus",
    })
    .populate({
      path: "supplierId",
      select: "name email shopName brandName",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // 🔹 Total count for pagination
  const totalSettlements = await SupplierSettlement.countDocuments(filter);

  // 🔹 Analytics (status-wise count)
  const analytics = await SupplierSettlement.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$payableAmount" },
      },
    },
  ]);

  const analyticsSummary = {
    totalPending: 0,
    totalTransferred: 0,
    totalRequested: 0,
  };

  analytics.forEach((item) => {
    if (item._id === "pending") analyticsSummary.totalPending = item.count;
    if (item._id === "transferred")
      analyticsSummary.totalTransferred = item.count;
    if (item._id === "requested") analyticsSummary.totalRequested = item.count;
  });

  return {
    data: settlements,
    analytics: analyticsSummary,
    meta: {
      page,
      limit,
      total: totalSettlements,
      totalPages: Math.ceil(totalSettlements / limit),
    },
  };
};

const getSupplierSettlement = async (
  email: string,
  query: ISettlementQuery,
) => {
  // 🔹 Step 1: User check
  const isExistSupplier = await User.findOne({ email });
  if (!isExistSupplier) {
    throw new AppError("Your account does not exist", StatusCodes.NOT_FOUND);
  }

  // 🔹 Step 2: Supplier profile check
  const supplier = await JoinAsSupplier.findOne({
    userId: isExistSupplier._id,
  });
  if (!supplier) {
    throw new AppError(
      "You have not applied to be a supplier",
      StatusCodes.NOT_FOUND,
    );
  }

  // 🔹 Step 3: Pagination + Filter
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {
    supplierId: supplier._id,
  };

  if (query.status) {
    filter.status = query.status;
  }

  // 🔹 Step 4: Settlement list
  const settlements = await SupplierSettlement.find(filter)
    .populate({
      path: "orderId",
      model: Order,
      select: "orderNumber orderUniqueId totalAmount orderStatus paymentStatus",
    })
    .populate({
      path: "supplierId",
      select: "name email shopName brandName",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // 🔹 Step 5: Pagination count
  const totalSettlements = await SupplierSettlement.countDocuments(filter);

  // 🔹 Step 6: Analytics (supplier-wise)
  const analyticsRaw = await SupplierSettlement.aggregate([
    {
      $match: {
        supplierId: supplier._id,
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalPayable: { $sum: "$payableAmount" },
      },
    },
  ]);

  const analytics = {
    totalPending: 0,
    totalTransferred: 0,
    totalRequested: 0,
  };

  analyticsRaw.forEach((item) => {
    if (item._id === "pending") analytics.totalPending = item.count;
    if (item._id === "transferred") analytics.totalTransferred = item.count;
    if (item._id === "requested") analytics.totalRequested = item.count;
  });

  return {
    analytics,
    data: settlements,
    meta: {
      page,
      limit,
      total: totalSettlements,
      totalPages: Math.ceil(totalSettlements / limit),
    },
  };
};

const supplierSettlementService = {
  getAllSupplierSettlements,
  getSupplierSettlement,
};

export default supplierSettlementService;
