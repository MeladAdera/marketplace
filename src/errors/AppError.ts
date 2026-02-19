// src/errors/AppError.ts

export class AppError extends Error {
  public readonly statusCode: number;    // HTTP status code (400, 401, 404, 500...)
  public readonly errorCode: string;     // كود الخطأ الفريد (مثل: INVALID_CREDENTIALS)
  public readonly isOperational: boolean; // true = خطأ متوقع (مثل validation)
  public readonly details?: Record<string, any>; // تفاصيل إضافية

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_SERVER_ERROR',
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;

    // ✅ تحديد stack trace بشكل صحيح
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * تحويل الخطأ إلى JSON لإرساله للعميل
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
      }
    };
  }
}