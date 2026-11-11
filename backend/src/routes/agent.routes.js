import { Router } from 'express';
import { config } from '../config/index.js';
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

const settingsSchema = z.object({
  level: z.number().int().min(0).max(4),
  permissions: z.record(z.boolean()).optional().default({}),
  spendingLimit: z.number().min(0).max(1000000).optional().default(0),
});

const approvalResponseSchema = z.object({ approved: z.boolean() });

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  mandateToken: z.string().min(1).optional(),
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
 * GET /api/agent/identity
 * KYA identity card: agent id, owner, public key, verification checks
 */
router.get('/identity', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await agentService.getIdentity(req.user.id));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/status
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await agentService.getStatus(req.user.id));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/settings
 * PUT /api/agent/settings
 * Autonomy level (0-4), per-action overrides and monthly spending limit
 */
router.get('/settings', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await agentService.getSettings(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.put('/settings', authenticate, validateBody(settingsSchema), async (req, res, next) => {
  try {
    successResponse(res, await agentService.updateSettings(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
});

/**
 * Pending confirmations: list, read, and approve or deny
 */
router.get('/approvals', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await agentService.getPendingApprovals(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.get('/approvals/:id', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await agentService.getApproval(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post('/approvals/:id/respond', authenticate, validateBody(approvalResponseSchema), async (req, res, next) => {
  try {
    successResponse(res, await agentService.respondToApproval(req.user.id, req.params.id, req.body.approved));
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

/**
 * POST /api/agent/chat/stream
 * Same as /chat, but sent as server-sent events: `text`, `tool_start`, `tool_result`, then
 * `done` (with the same result /chat returns) or `error`. Off when AI_STREAMING=false.
 */
router.post('/chat/stream', authenticate, requireRole('driver'), validateBody(chatSchema), async (req, res, next) => {
  if (!config.ai.streaming) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Streaming is turned off' } });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const result = await agentService.chat(req.user.id, req.body, {
      onText: (text) => send('text', { text }),
      onToolStart: (name) => send('tool_start', { name }),
      onToolResult: (name, ok) => send('tool_result', { name, ok }),
    });
    send('done', result);
  } catch (error) {
    send('error', { code: error.code || 'ERROR', message: error.message });
  }
  res.end();
});

export default router;
