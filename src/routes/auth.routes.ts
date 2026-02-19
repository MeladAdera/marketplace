// src/routes/auth.routes.ts (محدث)

import { Router } from "express";
import {
  loginController,
  signupController,
  logoutController,
  refreshController,
  getMeController  
} from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
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
 */
router.post(
  "/login", 
  validate(loginValidation),  
  loginController
);

/**
 * POST /auth/signup
 */
router.post(
  "/signup", 
  validate(signupValidation),  
  signupController
);

/**
 * POST /auth/logout
 */
router.post(
  "/logout", 
  validate(logoutValidation),  
  logoutController  
);

/**
 * POST /auth/refresh
 */
router.post(
  "/refresh", 
  validate(refreshValidation),  
  refreshController
);

/**
 * GET /auth/me
 */
router.get(
  "/me", 
  validate(getMeValidation),
  authMiddleware, 
  getMeController  
);

export default router;