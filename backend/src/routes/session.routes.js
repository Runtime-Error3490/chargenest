import { Router } from 'express';
import { z } from 'zod';

import { sessionService } from '../services/session.service.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const confirmSchema = z.object({
  confirmedBy: z.enum(['driver', 'host']),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/sessions/:bookingId
 * Get session details for a booking
 */
router.get('/:bookingId', authenticate, async (req, res, next) => {
  try {
    const result = await sessionService.getSession(
      req.params.bookingId,
      req.user.id
    );
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:bookingId/start
 * Confirm session start
 */
router.post('/:bookingId/start', authenticate, validateBody(confirmSchema), async (req, res, next) => {
  try {
    const result = await sessionService.confirmStart(
      req.params.bookingId,
      req.user.id,
      req.body.confirmedBy
    );
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:bookingId/end
 * End session (triggers payment capture)
 */
router.post('/:bookingId/end', authenticate, validateBody(confirmSchema), async (req, res, next) => {
  try {
    const result = await sessionService.endSession(
      req.params.bookingId,
      req.user.id,
      req.body.confirmedBy
    );
    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
