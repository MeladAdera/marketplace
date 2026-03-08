import { Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ValidatedRequest } from "../middlewares/validate.middleware"; 
import {
  blockVendorUserService,
  getVendorStatisticsService,
  getVendorUserService,
  listVendorUsersService,
  updateVendorUserRoleService,
} from "../services/vendor-admin.service";

type AuthValidatedRequest = AuthRequest & ValidatedRequest;

/**
 * GET /vendor/statistics
 */
export const getVendorStatisticsController = asyncHandler(
  async (req: AuthValidatedRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const t = req.t;

    const filters = {
      period: req.query.period,
      fromDate: req.query.from_date,
      toDate: req.query.to_date,
    };

    const result = await getVendorStatisticsService(organizationId, filters, t);

    return res.status(200).json(result);
  }
);

/**
 * GET /vendor/users
 */
export const listVendorUsersController = asyncHandler(
  async (req: AuthValidatedRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const t = req.t;

  const filters = {
  role: req.query.role,
  isActive: req.query.active,
  search: req.query.search,
  page: req.query.page,
  limit: req.query.limit
};

    const result = await listVendorUsersService(organizationId, filters, t);

    return res.status(200).json(result);
  }
);
// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users/:id - CONTROLLER
// Get single user details
// ─────────────────────────────────────────────────────────────

export const getVendorUserController = asyncHandler(
  async (req: AuthValidatedRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const t = req.t;
    const { id } = req.params as { id: string };

    const result = await getVendorUserService(id, organizationId, t);

    return res.status(200).json(result);
  }
);
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/block - CONTROLLER
// Block or unblock a user
// ─────────────────────────────────────────────────────────────

export const blockVendorUserController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const actorUserId = req.user!.id;
    const t = req.t;
    const { id } = req.params as { id: string };

    const result = await blockVendorUserService(
      id,
      organizationId,
      actorUserId,
      req.body,
      t
    );

    return res.status(200).json(result);
  }
);
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/role - CONTROLLER
// Change user role (Downgrade only)
// ─────────────────────────────────────────────────────────────

export const updateVendorUserRoleController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const actorUserId = req.user!.id;
    const t = req.t;
    const { id } = req.params as { id: string };

    const result = await updateVendorUserRoleService(
      id,
      organizationId,
      actorUserId,
      req.body,
      t
    );

    return res.status(200).json(result);
  }
);