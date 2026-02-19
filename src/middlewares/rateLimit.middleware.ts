// src/middlewares/rateLimit.middleware.ts
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// مخزن مؤقت للـ IPs (في الإنتاج استخدم Redis)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات كحد أقصى
  skipSuccessfulRequests: true, // لا تحسب المحاولات الناجحة
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    return res.status(429).json({
      success: false,
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many login attempts. Please try again after 15 minutes"
      }
    });
  },
  keyGenerator: (req: Request): string => {
    // استخدم IP + email لمنع هجمات distributed
    const email = req.body?.email || '';
    return (req.ip || 'unknown') + ':' + email;
  }
});

// Rate limiter عام لـ API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 دقيقة
  max: 100, // 100 طلب كحد أقصى
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please slow down"
    }
  }
});

// Rate limiter صارم لإنشاء الحسابات
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ساعة
  max: 3, // 3 حسابات كحد أقصى من نفس IP
  message: {
    success: false,
    error: {
      code: "SIGNUP_LIMIT_EXCEEDED",
      message: "Too many accounts created from this IP"
    }
  }
});

export { loginLimiter, apiLimiter, signupLimiter };