// src/middlewares/rbac.middleware.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { ForbiddenError } from "../errors/AppError";
export const rbacMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ForbiddenError("You do not have permission to access this resource");
    }

    return next();
  };
};;