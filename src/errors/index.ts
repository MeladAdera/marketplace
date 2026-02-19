// ==========================================
// src/errors/index.ts
// ==========================================

import { AppError } from './AppError';

// تصدير الكلاس الأساسي
export { AppError } from './AppError';

// تصدير أخطاء المصادقة
export * from './auth.errors';

// تصدير أخطاء البائعين
export * from './vendor.errors';

// تصدير أخطاء المنتجات
export * from './product.errors';

// تصدير أخطاء قاعدة البيانات
export * from './database.errors';

/**
 * دوال مساعدة للتحقق من نوع الخطأ
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  return isAppError(error) && error.isOperational;
}