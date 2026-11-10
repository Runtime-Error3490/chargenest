import { Router } from 'express';
import { z } from 'zod';

import { authService } from '../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';
import { createAuditLog, AuditActions } from '../services/audit.service.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  roles: z.array(z.enum(['driver', 'host'])).optional().default(['driver']),
  // Terms & Conditions acceptance (required)
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms and Conditions to register',
  }),
  acceptPrivacy: z.boolean().refine(val => val === true, {
    message: 'You must accept the Privacy Policy to register',
  }),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const verifyMfaSchema = z.object({
  tempToken: z.string().min(1, 'Token is required'),
  totpCode: z.string().length(6, 'Code must be 6 digits'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    
    // Audit log
    await createAuditLog({
      action: AuditActions.USER_REGISTER,
      userId: result.userId,
      resource: 'user',
      resourceId: result.userId,
      details: { email: req.body.email, roles: req.body.roles },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });
    
    successResponse(res, result, 201);
  } catch (error) {
    // Log failed registration attempt
    await createAuditLog({
      action: AuditActions.USER_REGISTER,
      resource: 'user',
      details: { email: req.body.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      errorMessage: error.message,
    });
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login step 1 - verify credentials
 */
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    
    // Audit log - successful login (or MFA pending)
    await createAuditLog({
      action: AuditActions.USER_LOGIN,
      userId: result.user?.id,
      resource: 'session',
      details: { email: req.body.email, mfaRequired: result.mfaRequired || false },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });
    
    successResponse(res, result);
  } catch (error) {
    // Log failed login attempt
    await createAuditLog({
      action: AuditActions.USER_LOGIN_FAILED,
      resource: 'session',
      details: { email: req.body.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      errorMessage: error.message,
    });
    next(error);
  }
});

/**
 * POST /api/auth/verify-mfa
 * Login step 2 - verify TOTP code
 */
router.post('/verify-mfa', validateBody(verifyMfaSchema), async (req, res, next) => {
  try {
    const result = await authService.verifyMfa(req.body);
    
    // Audit log
    await createAuditLog({
      action: AuditActions.MFA_VERIFY,
      userId: result.user?.id,
      resource: 'session',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });
    
    successResponse(res, result);
  } catch (error) {
    await createAuditLog({
      action: AuditActions.MFA_VERIFY,
      resource: 'session',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      errorMessage: error.message,
    });
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', validateBody(refreshTokenSchema), async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body);
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/mfa-setup
 * Get MFA setup info (QR code)
 */
router.get('/mfa-setup', authenticate, async (req, res, next) => {
  try {
    const result = await authService.getMfaSetup(req.user.id);
    
    // Audit log
    await createAuditLog({
      action: AuditActions.MFA_ENABLE,
      userId: req.user.id,
      resource: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });
    
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/change-password
 * Change password
 */
router.post('/change-password', authenticate, validateBody(changePasswordSchema), async (req, res, next) => {
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    
    // Audit log
    await createAuditLog({
      action: AuditActions.PASSWORD_CHANGE,
      userId: req.user.id,
      resource: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
    });
    
    successResponse(res, result);
  } catch (error) {
    await createAuditLog({
      action: AuditActions.PASSWORD_CHANGE,
      userId: req.user.id,
      resource: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      errorMessage: error.message,
    });
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    successResponse(res, { user: req.user });
  } catch (error) {
    next(error);
  }
});

export default router;
