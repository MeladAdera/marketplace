// ==========================================
// src/controllers/vendor.controller.ts (محدث)
// ==========================================

import { Request, Response } from "express";
import { 
  registerVendorService,
  getVendorProfileService,
  inviteStaffService,
  getVendorProductsService,
  updateVendorProfileService
} from "../services/vendor.service";
import { 
  RegisterVendorInput, 
  InviteStaffInput,
  VendorProductFilters, 
  UpdateVendorInput
} from "../types/vendor.types";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import {
  UnauthorizedError,
  ForbiddenError,
  NoOrganizationError,
  OrganizationNotFoundError,
  AdminNotFoundError,
  UserAlreadyInOrganizationError,
  EmailAlreadyRegisteredError,
  SlugAlreadyExistsError,
  EmailAlreadyExistsError
} from "../errors";

/**
 * 1️⃣ POST /vendors/register - تسجيل شركة جديدة
 */
export const registerVendorController = asyncHandler(async (req: Request, res: Response) => {
  const { companyName, companySlug, adminEmail, adminPassword } = req.body;
  // ✅ Zod already validated all fields

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  const userAgent = req.headers["user-agent"] ?? null;

  const input: RegisterVendorInput = {
    companyName,
    companySlug,
    adminEmail: adminEmail.toLowerCase().trim(),
    adminPassword,
    ipAddress,
    userAgent
  };

  const result = await registerVendorService(input);

  const { setSessionCookie } = require("../utils/cookies");
  setSessionCookie(res, result.sessionToken, result.session.expiresAt);

  return res.status(201).json({
    success: true,
    data: {
      user: result.user,
      organization: result.organization
    }
  });
});

/**
 * 2️⃣ GET /vendors/me - جلب ملف الشركة
 */
export const getVendorProfileController = asyncHandler(async (req: AuthRequest, res: Response) => {
  // ✅ تحقق من وجود المستخدم
  if (!req.user) {
    throw new UnauthorizedError();
  }

  // ✅ تحقق من الصلاحيات
  if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  // ✅ تحقق من وجود منشأة
  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const profile = await getVendorProfileService(req.user.organization_id);

  return res.status(200).json({
    success: true,
    data: profile
  });
});

/**
 * 3️⃣ POST /vendors/users/invite - دعوة موظف جديد
 */
export const inviteStaffController = asyncHandler(async (req: AuthRequest, res: Response) => {
  // ✅ تحقق من وجود المستخدم
  if (!req.user) {
    throw new UnauthorizedError();
  }

  // ✅ فقط vendor_admin يمكنه دعوة موظفين
  if (req.user.role !== 'vendor_admin') {
    throw new ForbiddenError('Only vendor admin can invite staff');
  }

  // ✅ تحقق من وجود منشأة
  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { email, role } = req.body;
  // ✅ Zod already validated email format and role

  const input: InviteStaffInput = {
    email: email.toLowerCase().trim(),
    role
  };

  const result = await inviteStaffService(
    req.user.organization_id,
    input,
    req.user.id
  );

  return res.status(201).json({
    success: true,
    data: result
  });
});


/**
 * 4️⃣ GET /vendors/products - جلب منتجات البائع
 */
export const getVendorProductsController = asyncHandler(async (req: AuthRequest, res: Response) => {
  // ✅ تحقق من وجود المستخدم
  if (!req.user) {
    throw new UnauthorizedError();
  }

  // ✅ تحقق من الصلاحيات
  if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  // ✅ تحقق من وجود منشأة
  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { page, limit, active, search } = req.query;
  // ✅ Zod already validated and transformed these values

  const filters: VendorProductFilters = {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    active: active === 'true' ? true : active === 'false' ? false : undefined,
    search: search as string
  };

  const result = await getVendorProductsService(req.user.organization_id, filters);

  return res.status(200).json({
    success: true,
    data: result
  });
  
});
 
export const updateVendorProfileController = asyncHandler(async (req: AuthRequest, res: Response) => {
  // ✅ تحقق من وجود المستخدم
  if (!req.user) {
    throw new UnauthorizedError();
  }

  // ✅ فقط vendor_admin يمكنه تحديث الملف
  if (req.user.role !== 'vendor_admin') {
    throw new ForbiddenError('Only vendor admin can update company profile');
  }

  // ✅ تحقق من وجود منشأة
  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { name, status } = req.body;
  // ✅ Zod already validated

  const input: UpdateVendorInput = {
    name,
    status
  };

  const updatedOrg = await updateVendorProfileService(
    req.user.organization_id,
    input,
    req.user.id
  );

  return res.status(200).json({
    success: true,
    data: {
      organization: updatedOrg
    }
  });
})