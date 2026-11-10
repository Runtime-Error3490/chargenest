import { Router } from 'express';
import { z } from 'zod';

import { deviceService } from '../services/device.service.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

const eventSchema = z.object({
  deviceId: z.string().min(1),
  bookingId: z.string().min(1),
  type: z.enum(['unlocked', 'meter', 'ended']),
  counter: z.number().int().min(0),
  ts: z.number().int(),
  payload: z.record(z.any()).default({}),
  signature: z.string().min(1),
});

const registerSchema = z.object({ chargerId: z.string().min(1) });

const simulateSchema = z.object({
  bookingId: z.string().min(1),
  scenario: z.enum(['success', 'short_session', 'bad_meter', 'fake_station', 'offline', 'no_unlock']),
  durationMin: z.number().positive().max(24 * 60).optional(),
  energyKwh: z.number().min(0).max(1000).optional(),
});

/**
 * POST /api/device/events
 * Signed event from the charger hardware. No login: the HMAC signature is the proof.
 */
router.post('/events', validateBody(eventSchema), async (req, res, next) => {
  try {
    successResponse(res, await deviceService.handleEvent(req.body));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/register
 * Host registers hardware on their charger. The secret is returned once.
 */
router.post('/register', authenticate, validateBody(registerSchema), async (req, res, next) => {
  try {
    successResponse(res, await deviceService.register(req.user.id, req.body.chargerId), 201);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/device/mock/simulate
 * Plays a device scenario for a booking. Only when DEVICE_MOCK=true (never in production).
 */
router.post('/mock/simulate', authenticate, validateBody(simulateSchema), async (req, res, next) => {
  try {
    successResponse(res, await deviceService.simulate(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
});

export default router;
