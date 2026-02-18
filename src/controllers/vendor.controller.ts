// src/controllers/vendor.controller.ts
import { Request, Response } from "express";
import { registerVendorService } from "../services/vendor.service";
import { RegisterVendorInput } from "../types/vendor.types";
import { AuthRequest } from "../middlewares/auth.middleware";

export async function registerVendorController(req: Request, res: Response) {
  try {
    const { companyName, companySlug, adminEmail, adminPassword } = req.body;

    // التحقق من المدخلات
    if (!companyName || !companySlug || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Company name, slug, email and password are required"
        }
      });
    }

    // التحقق من صحة الإيميل
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

    // التحقق من قوة كلمة المرور
    if (adminPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 6 characters"
        }
      });
    }

    // التحقق من صحة slug (حروف صغيرة وشرطات فقط)
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

    // تعيين الكوكي
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

    // فقط vendor_admin أو platform_admin يمكنهم رؤية الملف
    if (!['vendor_admin', 'platform_admin'].includes(req.user.role)) {
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

    // مؤقتاً نرجع بيانات بسيطة
    // لاحقاً هنجيبها من قاعدة البيانات مع الإحصائيات
    return res.status(200).json({
      success: true,
      data: {
        organization: {
          id: req.user.organization_id,
          name: "temp name", // لاحقاً نجيب الاسم من DB
          slug: "temp-slug",
          status: "active",
          created_at: new Date(),
          updated_at: new Date()
        },
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          organizationId: req.user.organization_id,
          isActive: true,
          createdAt: new Date()
        }
      }
    });

  } catch (err) {
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