// ==========================================
// src/middlewares/errorHandler.middleware.ts
// ==========================================

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError } from '../errors/index';
import { ZodError } from 'zod';
import i18next from '../config/i18n.config';

/**
 * معالج الأخطاء المركزي
 */
export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('=================================');
  console.error(`❌ ERROR at ${new Date().toISOString()}`);
  console.error(`📍 Path: ${req.method} ${req.path}`);
  console.error(`👤 User: ${(req as any).user?.id || 'anonymous'}`);
  console.error(`📝 Message: ${err.message}`);
  console.error('=================================');
  
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // 1️⃣ Zod Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    });
  }

  // 2️⃣ Postgres Errors
  if (err.name === 'PostgresError' || err.name === 'DatabaseError' || (err as any).code?.startsWith('23')) {
    if ((err as any).code === '23505') {
      const detail = (err as any).detail || '';
      const match = detail.match(/Key \((.*?)\)=\((.*?)\)/);
      
      if (match) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_ENTRY',
            message: `Duplicate entry for ${match[1]}: ${match[2]}`,
            details: { field: match[1], value: match[2] }
          }
        });
      }
      
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Duplicate entry'
        }
      });
    }

    if ((err as any).code === '23503') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced record does not exist'
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        ...(process.env.NODE_ENV === 'development' && { 
          details: err.message 
        })
      }
    });
  }

  // 3️⃣ AppError (✅ WITH I18N)
  if (isAppError(err)) {
    let message = err.message;

    if (req.t && err.translationKey) {
      message = req.t(err.translationKey, { 
        ns: 'errors', 
        ...err.translationParams 
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: message,
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  }

  // 4️⃣ Generic Errors
  const statusCode = (err as any).statusCode || 500;
  let message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  
  if (req.t && statusCode === 500) {
    message = req.t('common.internal_error', { ns: 'errors' });
  }
  
  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

/**
 * ✅ MUST BE EXPORTED - 404 Handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const message = req.t 
    ? req.t('common.not_found', { ns: 'errors' }) 
    : `Cannot ${req.method} ${req.path}`;
  
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: message
    }
  });
}

/**
 * Async Handler Wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}