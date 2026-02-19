// src/routes/auth.routes.ts
import { Router } from "express";
import {
  loginController,
  signupController,
  logoutController,
  refreshController
} from "../controllers/auth.controller";
import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { 
  loginValidation, 
  signupValidation,
  refreshValidation,
  getMeValidation,
  logoutValidation 
} from "../validations";

const router = Router();

/**
 * POST /auth/login
 * - Validate: email + password
 * - Rate limiting (to be added)
 * - Controller: loginController
 */
router.post(
  "/login", 
  validate(loginValidation),  
  loginController
);

/**
 * POST /auth/signup
 * - Validate: email + password + role + organizationId
 * - Controller: signupController
 */
router.post(
  "/signup", 
  validate(signupValidation),  
  signupController
);

/**
 * POST /auth/logout
 * - Validate: session_token (optional)
 * - Controller: logoutController
 */
router.post(
  "/logout", 
  validate(logoutValidation),  
);

/**
 * POST /auth/refresh
 * - Validate: session_token (required)
 * - Controller: refreshController
 */
router.post(
  "/refresh", 
  validate(refreshValidation),  
  refreshController
);

/**
 * GET /auth/me
 * - Validate: session_token (required)
 * - Middleware: authMiddleware (gets user from session)
 * - Returns: user info
 */
router.get(
  "/me", 
  validate(getMeValidation),
  authMiddleware, 
  (req: AuthRequest, res) => { 
    res.json({ 
      success: true,
      data: { user: req.user }  
    });
  }
);

export default router;