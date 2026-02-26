// src/errors/AppError.ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;
  
  // ✅ New properties for i18n
  public readonly translationKey?: string; 
  public readonly translationParams?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_SERVER_ERROR',
    isOperational: boolean = true,
    details?: Record<string, any>,
    translationKey?: string, 
    translationParams?: Record<string, any> 
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    this.translationKey = translationKey;
    this.translationParams = translationParams;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message, // This will be overridden by errorHandler if key exists
        ...(this.details && { details: this.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
      }
    };
  }
}
export class ValidationError extends AppError {
  constructor(
    translationKey: string,
    translationParams?: Record<string, any>,
    details?: Record<string, any>
  ) {
    super(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      true,
      details,
      translationKey,
      translationParams
    );
  }
}
export class NotFoundError extends AppError {
  constructor(message: string, code: string = "NOT_FOUND") {
    super(message, 404, code);
  }
}