// src/middlewares/rateLimit.middleware.ts
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  skipSuccessfulRequests: true, 
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
    const email = req.body?.email || '';
    return (req.ip || 'unknown') + ':' + email;
  }
});

// Rate limiter 
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 100, 
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please slow down"
    }
  }
});

// Rate limiter 
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 3, 
  message: {
    success: false,
    error: {
      code: "SIGNUP_LIMIT_EXCEEDED",
      message: "Too many accounts created from this IP"
    }
  }
});

export { loginLimiter, apiLimiter, signupLimiter };