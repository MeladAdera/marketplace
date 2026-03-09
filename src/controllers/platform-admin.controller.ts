// src/controllers/platform-admin.controller.ts
// Platform Admin - Vendor Management Controllers

import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  listVendorsQuery,
  getVendorDetailsQuery,
  updateVendorCommand,
  suspendVendorCommand,
  activateVendorCommand,
  deleteVendorCommand,
  restoreVendorCommand,
} from "../services/platform-admin.service";
import { SuspendVendorInput, ActivateVendorInput } from "../types/organization.types";

/** 📋 List vendors with pagination & filters */
export const listAdminVendorsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      status: req.query.status as 'active' | 'suspended' | 'deleted' | undefined,
      search: req.query.search as string | undefined,
      sortBy: req.query.sortBy as 'created_at' | 'name' | 'status' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const result = await listVendorsQuery(filters);
    res.status(200).json({ success: true, message: req.t("list_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};

/** 🔍 Get vendor details + stats + staff list */
export const getVendorAdminController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await getVendorDetailsQuery(id);
    res.status(200).json({ success: true, message: req.t("details_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};

/** ✏️ Update vendor basic info (name, slug) */
export const updateVendorAdminController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { name, slug } = req.body;
    const result = await updateVendorCommand(id, { name, slug }, req.user!.id);
    res.status(200).json({ success: true, message: req.t("update_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};

/** 🚫 Suspend vendor: block login access */
export const suspendVendorController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { reason, duration_hours } = req.body;
    const input: SuspendVendorInput = { reason, duration_hours };
    const result = await suspendVendorCommand(id, input, req.user!.id);
    res.status(200).json({ success: true, message: req.t("suspended_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};

/** ✅ Reactivate suspended vendor */
export const activateVendorController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const { note } = req.body;
    const input: ActivateVendorInput = { note };
    const result = await activateVendorCommand(id, input, req.user!.id);
    res.status(200).json({ success: true, message: req.t("activated_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};

/** 🗑️ Soft delete vendor (with safety checks) */
export const deleteVendorAdminController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await deleteVendorCommand(id, req.user!.id);
    res.status(200).json({ success: true, message: req.t("deleted_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};

/** 🔄 Restore soft-deleted vendor */
export const restoreVendorController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const note = req.body?.note;
    const result = await restoreVendorCommand(id, req.user!.id, note);
    res.status(200).json({ success: true, message: req.t("restored_success", { ns: "vendor" }), data: result });
  } catch (error) { next(error); }
};