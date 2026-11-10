import { prisma } from '../utils/prisma.js';

/**
 * Audit Service
 * Centralized logging for compliance and accountability
 */

// Action types for consistent logging
export const AuditActions = {
  // Auth
  USER_REGISTER: 'USER_REGISTER',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',
  MFA_ENABLE: 'MFA_ENABLE',
  MFA_VERIFY: 'MFA_VERIFY',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  
  // Bookings
  BOOKING_CREATE: 'BOOKING_CREATE',
  BOOKING_CONFIRM: 'BOOKING_CONFIRM',
  BOOKING_CANCEL: 'BOOKING_CANCEL',
  BOOKING_COMPLETE: 'BOOKING_COMPLETE',
  BOOKING_NO_SHOW: 'BOOKING_NO_SHOW',
  
  // Sessions
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  
  // Payments
  PAYMENT_AUTHORIZE: 'PAYMENT_AUTHORIZE',
  PAYMENT_CAPTURE: 'PAYMENT_CAPTURE',
  PAYMENT_REFUND: 'PAYMENT_REFUND',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  HOST_PAYOUT: 'HOST_PAYOUT',
  
  // Disputes
  DISPUTE_CREATE: 'DISPUTE_CREATE',
  DISPUTE_AI_REVIEW: 'DISPUTE_AI_REVIEW',
  DISPUTE_RESOLVE: 'DISPUTE_RESOLVE',
  
  // Chargers
  CHARGER_CREATE: 'CHARGER_CREATE',
  CHARGER_UPDATE: 'CHARGER_UPDATE',
  CHARGER_DELETE: 'CHARGER_DELETE',
  
  // Agent/Mandate
  AGENT_CREATE: 'AGENT_CREATE',
  AGENT_REVOKE: 'AGENT_REVOKE',
  MANDATE_CREATE: 'MANDATE_CREATE',
  MANDATE_USE: 'MANDATE_USE',
  MANDATE_REVOKE: 'MANDATE_REVOKE',
  
  // Admin actions
  ADMIN_USER_ACTION: 'ADMIN_USER_ACTION',
  ADMIN_CONFIG_UPDATE: 'ADMIN_CONFIG_UPDATE',
  ADMIN_DATA_EXPORT: 'ADMIN_DATA_EXPORT',
  ADMIN_DISPUTE_RESOLVE: 'ADMIN_DISPUTE_RESOLVE',
  
  // Ratings
  RATING_SUBMIT: 'RATING_SUBMIT',
};

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {string} params.action - The action being logged (use AuditActions enum)
 * @param {string} [params.userId] - User who performed the action
 * @param {string} [params.agentId] - Agent that performed the action (for AI actions)
 * @param {string} [params.mandateId] - Related mandate ID
 * @param {string} [params.bookingId] - Related booking ID
 * @param {string} [params.paypalOrderId] - Related PayPal order ID
 * @param {string} [params.resource] - Type of resource affected (user, charger, booking, etc.)
 * @param {string} [params.resourceId] - ID of the affected resource
 * @param {Object} [params.details] - Additional details about the action
 * @param {Object} [params.inputs] - Input data (will be sanitized)
 * @param {Object} [params.outputs] - Output/result data
 * @param {boolean} [params.success=true] - Whether the action succeeded
 * @param {string} [params.errorMessage] - Error message if failed
 * @param {number} [params.durationMs] - How long the action took
 * @param {string} [params.ipAddress] - Client IP address
 * @param {string} [params.userAgent] - Client user agent
 */
export async function createAuditLog({
  action,
  userId = null,
  agentId = null,
  mandateId = null,
  bookingId = null,
  paypalOrderId = null,
  resource = null,
  resourceId = null,
  details = null,
  inputs = null,
  outputs = null,
  success = true,
  errorMessage = null,
  durationMs = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    // Combine details with inputs for storage
    const combinedInputs = {
      ...(inputs || {}),
      ...(details || {}),
      ...(resource && { resource }),
      ...(resourceId && { resourceId }),
      ...(ipAddress && { ipAddress }),
      ...(userAgent && { userAgent: userAgent?.substring(0, 255) }), // Limit length
    };

    // Sanitize inputs to remove sensitive data
    const sanitizedInputs = Object.keys(combinedInputs).length > 0 ? sanitizeData(combinedInputs) : null;
    const sanitizedOutputs = outputs ? sanitizeData(outputs) : null;

    await prisma.auditLog.create({
      data: {
        action,
        userId,
        agentId,
        mandateId,
        bookingId,
        paypalOrderId,
        inputs: sanitizedInputs,
        outputs: sanitizedOutputs,
        success,
        errorMessage,
        durationMs,
      },
    });
  } catch (error) {
    // Don't let audit logging failures break the main flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Sanitize data by removing sensitive fields
 */
function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = [
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'accessToken',
    'refreshToken',
    'totpSecret',
    'totp_secret',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Helper to log with timing
 */
export async function logWithTiming(action, userId, asyncFn) {
  const startTime = Date.now();
  let success = true;
  let errorMessage = null;
  let result = null;

  try {
    result = await asyncFn();
    return result;
  } catch (error) {
    success = false;
    errorMessage = error.message;
    throw error;
  } finally {
    const durationMs = Date.now() - startTime;
    await createAuditLog({
      action,
      userId,
      success,
      errorMessage,
      durationMs,
      outputs: success ? { resultType: typeof result } : null,
    });
  }
}

export const auditService = {
  createAuditLog,
  logWithTiming,
  AuditActions,
};

export default auditService;
