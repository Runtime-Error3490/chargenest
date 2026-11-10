/**
 * Custom error classes for the application
 */

export class AppError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthError extends AppError {
  constructor(code, message, details = null) {
    super(code, message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', details = null) {
    super('FORBIDDEN', message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', details = null) {
    super('NOT_FOUND', `${resource} not found`, 404, details);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(code, message, details = null) {
    super(code, message, 409, details);
  }
}

export class PaymentError extends AppError {
  constructor(message, details = null) {
    super('PAYPAL_ERROR', message, 502, details);
  }
}

export class AIError extends AppError {
  constructor(message, details = null) {
    super('AI_ERROR', message, 502, details);
  }
}

export class MandateError extends AppError {
  constructor(code, message, details = null) {
    super(code, message, 400, details);
  }
}
