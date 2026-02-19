// src/middlewares/validate.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";  // ✅ v3 imports

/**
 * =======================================================
 * VALIDATION MIDDLEWARE
 * =======================================================
 */

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate all parts of the request
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
        headers: req.headers
      });
      
      return next();
      
    } catch (error) {
      if (error instanceof ZodError) {
        // ✅ في v3 نستخدم error.errors
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: formattedErrors
          }
        });
        return;
      }
      
      return next(error);
    }
  };
};