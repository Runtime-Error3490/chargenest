/**
 * Standard API response helpers
 */

export function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function errorResponse(res, code, message, statusCode = 400, details = null) {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
}

export function paginatedResponse(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}

// Common error codes
export const ErrorCodes = {
  // Auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_MFA_REQUIRED: 'AUTH_MFA_REQUIRED',
  AUTH_MFA_INVALID: 'AUTH_MFA_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_ROLE_REQUIRED: 'USER_ROLE_REQUIRED',

  // Charger
  CHARGER_NOT_FOUND: 'CHARGER_NOT_FOUND',
  CHARGER_NOT_AVAILABLE: 'CHARGER_NOT_AVAILABLE',

  // Booking
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
  BOOKING_CANNOT_CANCEL: 'BOOKING_CANNOT_CANCEL',

  // Session
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_STARTED: 'SESSION_ALREADY_STARTED',
  SESSION_ALREADY_ENDED: 'SESSION_ALREADY_ENDED',
  SESSION_NOT_STARTED: 'SESSION_NOT_STARTED',

  // Payment
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_ALREADY_CAPTURED: 'PAYMENT_ALREADY_CAPTURED',

  // Dispute
  DISPUTE_NOT_FOUND: 'DISPUTE_NOT_FOUND',
  DISPUTE_ALREADY_EXISTS: 'DISPUTE_ALREADY_EXISTS',
  DISPUTE_WINDOW_EXPIRED: 'DISPUTE_WINDOW_EXPIRED',

  // Mandate
  MANDATE_INVALID: 'MANDATE_INVALID',
  MANDATE_EXPIRED: 'MANDATE_EXPIRED',
  MANDATE_EXCEEDED: 'MANDATE_EXCEEDED',
  MANDATE_REVOKED: 'MANDATE_REVOKED',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PAYPAL_ERROR: 'PAYPAL_ERROR',
  AI_ERROR: 'AI_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
};
