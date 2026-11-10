import { Router } from 'express';
import { z } from 'zod';

import { agentService } from '../services/agent.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { successResponse, paginatedResponse } from '../utils/apiResponse.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createMandateSchema = z.object({
  maxAmount: z.number().min(100).max(100000).optional().default(1000),
  maxDistanceKm: z.number().min(1).max(100).optional().default(10),
  connectorTypes: z.array(z.enum(['Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT'])).optional().default([]),
  expiresInHours: z.number().min(1).max(168).optional().default(24), // Max 1 week
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  mandateToken: z.string().min(1),
  context: z.object({
    currentLocation: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }).optional(),
  }).optional(),
});

const activityQuerySchema = z.object({
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/agent/mandates
 * Create a new spending mandate
 */
router.post('/mandates', authenticate, requireRole('driver'), validateBody(createMandateSchema), async (req, res, next) => {
  try {
    const result = await agentService.createMandate(req.user.id, req.body);
    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/mandates
 * Get user's mandates
 */
router.get('/mandates', authenticate, async (req, res, next) => {
  try {
    const includeExpired = req.query.includeExpired === 'true';
    const mandates = await agentService.getUserMandates(req.user.id, includeExpired);
    successResponse(res, { mandates });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/agent/mandates/:id
 * Revoke a mandate
 */
router.delete('/mandates/:id', authenticate, async (req, res, next) => {
  try {
    await agentService.revokeMandate(req.params.id, req.user.id);
    successResponse(res, { message: 'Mandate revoked successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/activity
 * Get agent activity log
 */
router.get('/activity', authenticate, validateQuery(activityQuerySchema), async (req, res, next) => {
  try {
    const result = await agentService.getAgentActivity(req.user.id, {
      page: req.query.page,
      limit: req.query.limit,
    });
    paginatedResponse(res, result.activities, result.pagination);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/agent/chat
 * Chat with the AI concierge
 */
router.post('/chat', authenticate, requireRole('driver'), validateBody(chatSchema), async (req, res, next) => {
  try {
    const result = await agentService.chat(req.user.id, req.body);
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
