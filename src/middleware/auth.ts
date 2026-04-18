import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import config from "../config";
import AppError from "../errors/AppError";
import logger from "../logger";
import { verifyToken } from "../utils/tokenGenerate";

const auth = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      // 🔴 Step 1: Check header exists
      if (!authHeader) {
        throw new AppError(
          "Authorization header missing",
          StatusCodes.UNAUTHORIZED,
        );
      }

      // 🔴 Step 2: Check Bearer format
      if (!authHeader.startsWith("Bearer ")) {
        throw new AppError("Invalid token format", StatusCodes.UNAUTHORIZED);
      }

      // 🔴 Step 3: Extract token
      const token = authHeader.split(" ")[1];

      if (!token) {
        throw new AppError("Token missing", StatusCodes.UNAUTHORIZED);
      }

      // 🔴 Step 4: Verify token
      const decoded = verifyToken(token, config.JWT_SECRET as string);

      // Attach user
      req.user = decoded;

      // 🔴 Step 5: Role check
      if (roles.length && !roles.includes((decoded as any).role)) {
        throw new AppError("You are not authorized!", StatusCodes.FORBIDDEN);
      }

      next();
    } catch (error: any) {
      console.error("FULL AUTH ERROR:", error.message);

      if (error.message === "Invalid or expired token") {
        return next(new AppError("Invalid token", StatusCodes.UNAUTHORIZED));
      }

      if (error instanceof AppError) {
        return next(error);
      }

      logger.error("Authorization error:", error);
      next(new AppError("You are not authorized", StatusCodes.UNAUTHORIZED));
    }
  };
};

export default auth;

export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token, config.JWT_SECRET as string);
    req.user = decoded;
  } catch (err) {
    // ignore invalid token → treat as guest
  }

  next();
};
