// ==========================================
// src/middlewares/errorHandler.middleware.ts
// ==========================================

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError } from '../errors/index';
import { ZodError } from 'zod';

/**
 * معالج الأخطاء المركزي
 * 
 * هذا الميدلوير يتعامل مع كل الأخطاء في التطبيق
 * ويرد بردود مناسبة للعميل
 */
export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1️⃣ تسجيل الخطأ (مهم جداً للتصحيح)
  console.error('=================================');
  console.error(`❌ ERROR at ${new Date().toISOString()}`);
  console.error(`📍 Path: ${req.method} ${req.path}`);
  console.error(`👤 User: ${(req as any).user?.id || 'anonymous'}`);
  console.error(`📝 Message: ${err.message}`);
  console.error('=================================');
  
  // للتصحيح في بيئة التطوير - نطبع الـ stack
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // 2️⃣ التعامل مع أخطاء Zod (Validation)
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

  // 3️⃣ التعامل مع أخطاء PostgreSQL
  if (err.name === 'PostgresError' || err.name === 'DatabaseError' || (err as any).code?.startsWith('23')) {
    
    // أخطاء unique constraint (code 23505)
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

    // أخطاء foreign key (code 23503)
    if ((err as any).code === '23503') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced record does not exist'
        }
      });
    }

    // أخطاء عامة في قاعدة البيانات
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

  // 4️⃣ التعامل مع أخطاء التطبيق المخصصة (AppError)
  if (isAppError(err)) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // 5️⃣ التعامل مع أخطاء غير متوقعة
  const statusCode = (err as any).statusCode || 500;
  
  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack 
      })
    }
  });
}

/**
 * ميدلوير للتعامل مع المسارات غير الموجودة (404)
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    }
  });
}

/**
 * ميدلوير للتعامل مع الأخطاء في الـ async functions
 * هذا يغلف الـ controller ويضمن تمرير الأخطاء لـ errorHandler
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}