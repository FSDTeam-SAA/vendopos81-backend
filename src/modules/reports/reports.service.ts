import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import JoinAsSupplier from "../joinAsSupplier/joinAsSupplier.model";
import Product from "../product/product.model";
import { User } from "../user/user.model";

const getTopBuyers = async () => {
  const topBuyers = await User.aggregate([
    // Step 1: Only customers
    { $match: { role: "customer" } },

    // Step 2: Join with orders
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },

    // Step 3: Calculate totalOrder and totalSpent
    {
      $addFields: {
        totalOrder: { $size: "$orders" },
        totalSpent: { $sum: "$orders.totalPrice" },
      },
    },

    // Step 4: Only include required fields
    {
      $project: {
        firstName: 1,
        lastName: 1,
        totalOrder: 1,
        totalSpent: 1,
      },
    },

    // Step 5: Sort by totalSpent descending
    { $sort: { totalSpent: -1 } },

    // Step 6: Limit to top 5
    { $limit: 5 },
  ]);

  return topBuyers;
};

const getSingleTopRatedBuyer = async (userId: string) => {
  const buyer = await User.aggregate([
    // Step 1: Match the specific user
    { $match: { _id: new mongoose.Types.ObjectId(userId), role: "customer" } },

    // Step 2: Join with orders
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "userId",
        as: "orders",
      },
    },

    // Step 3: Analytics fields
    {
      $addFields: {
        totalOrder: { $size: "$orders" },
        totalSpent: { $sum: "$orders.totalPrice" },
      },
    },

    // Step 4: Sort orders by purchaseDate descending
    {
      $addFields: {
        recentOrders: {
          $slice: [
            {
              $map: {
                input: { $reverseArray: "$orders" }, // latest orders first
                as: "o",
                in: {
                  orderUniqueId: "$$o.orderUniqueId",
                  totalPrice: "$$o.totalPrice",
                  paymentStatus: "$$o.paymentStatus",
                  orderStatus: "$$o.orderStatus",
                  purchaseDate: "$$o.purchaseDate",
                },
              },
            },
            5, // Show only 5 recent orders
          ],
        },
      },
    },

    // Step 5: Select only required fields
    {
      $project: {
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        createdAt: 1,
        totalOrder: 1,
        totalSpent: 1,
        recentOrders: 1,
      },
    },
  ]);

  if (!buyer || buyer.length === 0) {
    throw new Error("Customer not found");
  }

  return buyer[0];
};

const getTopSuppliers = async () => {
  try {
    const topSuppliers = await JoinAsSupplier.find({
      isSuspended: false,
      status: "approved",
    })
      .sort({ totalSales: -1 })
      .limit(5)
      .select("shopName brandName logo totalSales totalOrders rating")
      .lean();

    const result = topSuppliers.map((s) => ({
      id: s._id,
      shopName: s.shopName,
      brandName: s.brandName,
      logo: s.logo?.url || null,
      totalOrders: s.totalOrders,
      totalValue: s.totalSales,
      rating: s.rating,
    }));

    return result;
  } catch (error) {
    throw new AppError(
      "Failed to fetch top suppliers",
      StatusCodes.BAD_REQUEST,
    );
  }
};

const getTopRatedProducts = async (limit: number = 10) => {
  try {
    // 1️⃣ Fetch products with populated category
    const products: any = await Product.find({
      // status: "approved",
      isAvailable: true,
    })
      .sort({ averageRating: -1, totalSold: -1 }) // highest rating first, then totalSold
      .limit(limit)
      .populate({
        path: "categoryId",
        select: "region title", // only get region & title
      })
      .select("title averageRating totalSold categoryId") // select fields for response
      .lean();

    // 2️⃣ Transform response
    const result = products.map((p: any) => ({
      id: p._id,
      title: p.title,
      categoryRegion: p.categoryId?.region || null,
      totalSold: p.totalSold || 0,
      rating: p.averageRating || 0,
    }));

    return result;
  } catch (error) {
    throw new AppError(
      "Failed to fetch top rated products",
      StatusCodes.BAD_REQUEST,
    );
  }
};
const reportsService = {
  getTopBuyers,
  getSingleTopRatedBuyer,
  getTopSuppliers,
  getTopRatedProducts,
};

export default reportsService;
