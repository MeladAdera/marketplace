// src/controllers/vendor.controller.ts
import { Request, Response } from "express";
import { 
  registerVendorService,
  getVendorProfileService,
  inviteStaffService,
  getVendorProductsService
} from "../services/vendor.service";
import { 
  RegisterVendorInput, 
  InviteStaffInput,
  VendorProductFilters 
} from "../types/vendor.types";
import { AuthRequest } from "../middlewares/auth.middleware";

// 1️⃣ تسجيل شركة جديدة
export async function registerVendorController(req: Request, res: Response) {
  try {
    const { companyName, companySlug, adminEmail, adminPassword } = req.body;

    if (!companyName || !companySlug || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Company name, slug, email and password are required"
        }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EMAIL",
          message: "Invalid email format"
        }
      });
    }

    if (adminPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 6 characters"
        }
      });
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(companySlug)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_SLUG",
          message: "Slug must contain only lowercase letters, numbers, and hyphens"
        }
      });
    }

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

  } catch (err: any) {
    if (err.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email already registered"
        }
      });
    }

    if (err.message === "SLUG_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        error: {
          code: "SLUG_ALREADY_EXISTS",
          message: "Company slug already taken"
        }
      });
    }

    console.error("Vendor registration error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}

// 2️⃣ جلب ملف الشركة
export async function getVendorProfileController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated"
        }
      });
    }

    if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions"
        }
      });
    }

    if (!req.user.organization_id) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NO_ORGANIZATION",
          message: "User does not belong to any organization"
        }
      });
    }

    const profile = await getVendorProfileService(req.user.organization_id);

    return res.status(200).json({
      success: true,
      data: profile
    });

  } catch (err: any) {
    if (err.message === "ORGANIZATION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: "ORGANIZATION_NOT_FOUND",
          message: "Organization not found"
        }
      });
    }

    if (err.message === "ADMIN_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMIN_NOT_FOUND",
          message: "Admin not found"
        }
      });
    }

    console.error("Get vendor profile error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}

// 3️⃣ دعوة موظف جديد
export async function inviteStaffController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated"
        }
      });
    }

    // فقط vendor_admin يمكنه دعوة موظفين
    if (req.user.role !== 'vendor_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only vendor admin can invite staff"
        }
      });
    }

    if (!req.user.organization_id) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NO_ORGANIZATION",
          message: "User does not belong to any organization"
        }
      });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Email and role are required"
        }
      });
    }

    if (!['vendor_staff', 'vendor_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ROLE",
          message: "Role must be vendor_staff or vendor_admin"
        }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EMAIL",
          message: "Invalid email format"
        }
      });
    }

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

  } catch (err: any) {
    if (err.message === "USER_ALREADY_IN_ORGANIZATION") {
      return res.status(409).json({
        success: false,
        error: {
          code: "USER_ALREADY_IN_ORGANIZATION",
          message: "User already exists in this organization"
        }
      });
    }

    if (err.message === "EMAIL_ALREADY_REGISTERED") {
      return res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_ALREADY_REGISTERED",
          message: "Email already registered in another organization"
        }
      });
    }

    console.error("Invite staff error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}

// 4️⃣ جلب منتجات البائع
export async function getVendorProductsController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated"
        }
      });
    }

    if (!['vendor_admin', 'vendor_staff', 'platform_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions"
        }
      });
    }

    if (!req.user.organization_id) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NO_ORGANIZATION",
          message: "User does not belong to any organization"
        }
      });
    }

    const { page, limit, active, search } = req.query;

    const filters: VendorProductFilters = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      search: search as string
    };

    const result = await getVendorProductsService(req.user.organization_id, filters);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error("Get vendor products error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}