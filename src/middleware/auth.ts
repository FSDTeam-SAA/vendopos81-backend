import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import config from "../config";
import AppError from "../errors/AppError";
import logger from "../logger";
import { verifyToken } from "../utils/tokenGenerate";

const auth = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const extractedToken = req.headers.authorization;
      const token = extractedToken?.split(" ")[1];

      if (!token) {
        throw new AppError("Invalid token", StatusCodes.UNAUTHORIZED);
      }

      // 1. Verify the token
      const verifyUserData = verifyToken(token, config.JWT_SECRET as string);

      req.user = verifyUserData;

      // 2. Check Role Authorization
      if (roles.length && !roles.includes(verifyUserData.role)) {
        throw new AppError("You are not authorized!", StatusCodes.UNAUTHORIZED);
      }

      next();
    } catch (error: any) {
      // --- DEBUG ERROR LOG ---
      console.error("FULL AUTH ERROR:", error);

      // 3. Use next(error) instead of throw
      if (error instanceof AppError) {
        return next(error);
      }

      logger.error("Authorization error:", error);
      next(new AppError("You are not authorized", StatusCodes.UNAUTHORIZED));
    }
  };
};

export default auth;

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(); // guest user allowed
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token, config.JWT_SECRET as string);
    req.user = decoded;
  } catch (err) {
    // invalid token → treat as guest
  }

  next();
};
