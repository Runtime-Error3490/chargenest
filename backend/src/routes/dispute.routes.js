import { Router } from 'express';
import { z } from 'zod';

import { disputeService } from '../services/dispute.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { successResponse, paginatedResponse } from '../utils/apiResponse.js';
import { createAuditLog, AuditActions } from '../services/audit.service.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const raiseDisputeSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  description: z.string().max(2000).optional(),
  evidence: z.object({
    photos: z.array(z.string().url()).optional(),
    timestamps: z.record(z.string()).optional(),
  }).optional(),
});

const listDisputesSchema = z.object({
  status: z.enum(['open', 'ai_reviewed', 'pending_admin', 'resolved', 'closed']).optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/disputes
 * Raise a dispute
 */
router.post('/', authenticate, validateBody(raiseDisputeSchema), async (req, res, next) => {
  try {
    const result = await disputeService.raiseDispute(req.user.id, req.body);

    // Audit log for dispute creation
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.DISPUTE_CREATE,
      resource: 'dispute',
      resourceId: result.dispute?.id,
      details: {
        bookingId: req.body.bookingId,
        reason: req.body.reason,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/disputes
 * Get user's disputes
 */
router.get('/', authenticate, validateQuery(listDisputesSchema), async (req, res, next) => {
  try {
    const result = await disputeService.getUserDisputes(req.user.id, {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    paginatedResponse(res, result.disputes, result.pagination);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/disputes/:id
 * Get dispute details
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const dispute = await disputeService.getDisputeById(req.params.id, req.user.id);
    successResponse(res, { dispute });
  } catch (error) {
    next(error);
  }
});

export default router;
