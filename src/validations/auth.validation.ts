// src/validations/auth.validation.ts
import { z } from "zod";
import { 
  emailSchema, 
  passwordSchema, 
  passwordLoginSchema,
  roleSchema 
} from "./common.validation";

/**
 * Login Validation
 * Why: Authenticate users
 * 
 * What we validate:
 * 1. Body: email and password
 *    - Email: valid format (from common)
 *    - Password: just not empty (login doesn't need strength check)
 * 
 * 2. Headers: for tracking (optional)
 *    - user-agent: what browser/device
 *    - x-forwarded-for: real IP behind proxy
 */
export const loginValidation = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordLoginSchema
  }),
  
  headers: z.object({
    'user-agent': z.string().optional(),
    'x-forwarded-for': z.string().optional()
  }).optional()
});

/**
 * Signup Validation
 * Why: Register new users
 * 
 * What we validate:
 * 1. Body:
 *    - email: valid format + transform to lowercase
 *    - password: strong password (min 6 chars + complexity)
 *    - role: must be valid role (defaults to 'customer')
 *    - organizationId: optional UUID (for vendor staff)
 * 
 * 2. Headers: for tracking
 */
export const signupValidation = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,  
    role: roleSchema.default('customer'),
    organizationId: z.string().uuid("Invalid organization ID").nullable().optional()
  }),
  
  headers: z.object({
    'user-agent': z.string().optional(),
    'x-forwarded-for': z.string().optional()
  }).optional()
});

/**
 * Refresh Token Validation
 * Why: Get new session token
 * 
 * What we validate:
 * - Cookie: session_token must exist
 * 
 * Why only cookie? Because refresh token is stored in httpOnly cookie
 * for security (can't be accessed by JavaScript)
 */
export const refreshValidation = z.object({
  cookies: z.object({
    session_token: z.string().min(1, "Session token is required")
  })
});

/**
 * Get Current User Validation
 * Why: Get user info from session
 * 
 * What we validate:
 * - Cookie: session_token must exist
 * 
 * Note: The actual user data comes from authMiddleware
 * This just ensures we have a session cookie
 */
export const getMeValidation = z.object({
  cookies: z.object({
    session_token: z.string().min(1, "Session token is required")
  })
});

/**
 * Logout Validation
 * Why: End user session
 * 
 * What we validate:
 * - Cookie: session_token (optional - if exists, we revoke it)
 * 
 * If no cookie, we still return success (already logged out)
 */
export const logoutValidation = z.object({
  cookies: z.object({
    session_token: z.string().optional()
  })
});