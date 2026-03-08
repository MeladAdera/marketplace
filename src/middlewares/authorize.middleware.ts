// src/middlewares/authorize.middleware.ts
// Flexible, policy-aware authorization middleware for fine-grained access control

import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { Permission, UserRole } from "../constants/permissions";
import { AuthorizationService } from "../services/authorization.service";
import { ForbiddenError } from "../errors/AppError";

/**
 * Type guard to validate that a string is a valid Permission enum value.
 * Provides runtime safety for dynamically provided permissions.
 */
function isValidPermission(value: string): value is Permission {
  return Object.values(Permission).includes(value as Permission);
}

/**
 * Authorization middleware factory.
 * 
 * Enforces permission-based access control with optional dynamic policy conditions.
 * Supports single or multiple permissions, with configurable logical operators.
 * 
 * @param permission - Required permission(s) to access the route
 * @param options.requireAll - If true, user must have ALL permissions; if false, ANY suffices
 * @param options.condition - Optional async function for context-aware policy checks
 * 
 * @example Basic permission check
 * ```ts
 * router.patch("/products/:id", authorize(Permission.PRODUCT_UPDATE));
 * ```
 * 
 * @example With dynamic ownership policy
 * ```ts
 * router.patch("/products/:id", 
 *   authorize(Permission.PRODUCT_UPDATE, {
 *     condition: async (req) => {
 *       const product = await Product.findById(req.params.id);
 *       AuthorizationService.assertOwnership(req.user!.organization_id, product);
 *       return true;
 *     }
 *   })
 * );
 * ```
 */
export const authorize = (
  permission: Permission | Permission[],
  options?: {
    requireAll?: boolean;
    condition?: (req: AuthRequest) => Promise<boolean> | boolean;
  }
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    // Ensure user is authenticated before checking permissions
    if (!user?.role) {
      throw new ForbiddenError("Authentication required");
    }

    // Normalize permission input to array for consistent processing
    const permissions = Array.isArray(permission) ? permission : [permission];
    
    // Filter out invalid permissions to catch configuration errors early
    const validPermissions = permissions.filter(isValidPermission);
    if (validPermissions.length === 0) {
      console.error("Invalid permission provided:", permissions);
      throw new ForbiddenError("Configuration error: invalid permission");
    }

    // Check if user's role grants the required permission(s)
    const hasAccess = AuthorizationService.hasPermissions(
      user.role as UserRole,
      validPermissions,
      options?.requireAll ?? false
    );

    if (!hasAccess) {
      throw new ForbiddenError("You do not have permission to access this resource");
    }

    // Evaluate optional dynamic policy condition (e.g., resource ownership, business rules)
    if (options?.condition) {
      try {
        const conditionMet = await options.condition(req);
        if (!conditionMet) {
          throw new ForbiddenError("Access denied by policy");
        }
      } catch (error) {
        // Re-throw known authorization errors; wrap unexpected errors safely
        if (error instanceof ForbiddenError) {
          throw error;
        }
        console.error("Authorization condition error:", error);
        throw new ForbiddenError("Access denied");
      }
    }

    // All checks passed; proceed to route handler
    return next();
  };
};