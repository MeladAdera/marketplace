// src/controllers/vendor.controller.ts 

import { Request, Response } from "express";
import { 
  registerVendorService,
  getVendorProfileService,
  // inviteStaffService,
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
} from "../errors";

/**
 * 1️⃣ POST /vendors/register 
 */
export const registerVendorController = asyncHandler(async (req: Request, res: Response) => {
  const { companyName, companySlug, adminEmail, adminPassword } = req.body;

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
    message: req.t('vendor.registered', { ns: 'vendor' }), 
    data: {
      user: result.user,
      organization: result.organization
    }
  });
});

/**
 * 2️⃣ GET /vendors/me 
 */
export const getVendorProfileController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const profile = await getVendorProfileService(req.user.organization_id);

  return res.status(200).json({
    success: true,
    message: req.t('profile_retrieved', { ns: 'vendor' }), 
    data: profile
  });
});

/**
//  * 3️⃣ POST /vendors/users/invite 
//  */
// export const inviteStaffController = asyncHandler(async (req: AuthRequest, res: Response) => {
//   if (!req.user) {
//     throw new UnauthorizedError();
//   }

//   if (req.user.role !== 'vendor_admin') {
//     throw new ForbiddenError('Only vendor admin can invite staff');
//   }

//   if (!req.user.organization_id) {
//     throw new NoOrganizationError();
//   }

//   const { email, role } = req.body;

//   const input: InviteStaffInput = {
//     email: email.toLowerCase().trim(),
//     role
//   };

//   const result = await inviteStaffService(
//     req.user.organization_id,
//     input,
//     req.user.id
//   );

//   return res.status(201).json({
//     success: true,
//     message: req.t('staff_invited', { ns: 'vendor' }), 
//     data: result
//   });
// });

/**
 * 4️⃣ GET /vendors/products 
 */
export const getVendorProductsController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { page, limit, active, search } = req.query;

  const filters: VendorProductFilters = {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    active: active === 'true' ? true : active === 'false' ? false : undefined,
    search: search as string
  };

  const result = await getVendorProductsService(req.user.organization_id, filters);

  return res.status(200).json({
    success: true,
    message: req.t('products_retrieved', { ns: 'vendor' }), 
    data: result
  });
});

/**
 * 5️⃣ PATCH /vendors/me - 
 */
export const updateVendorProfileController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (req.user.role !== 'vendor_admin') {
    throw new ForbiddenError('Only vendor admin can update company profile');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { name, status } = req.body;

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
    message: req.t('profile_updated', { ns: 'vendor' }), 
    data: {
      organization: updatedOrg
    }
  });
});