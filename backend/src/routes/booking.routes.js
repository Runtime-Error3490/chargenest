import { Router } from 'express';
import { z } from 'zod';

import { bookingService } from '../services/booking.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { successResponse, paginatedResponse } from '../utils/apiResponse.js';
import { config } from '../config/index.js';
import { createAuditLog, AuditActions } from '../services/audit.service.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createBookingSchema = z.object({
  chargerId: z.string().uuid(),
  // Either a fixed package, or a duration priced from the host's hourly rate
  packageId: z.string().uuid().optional(),
  durationMin: z.number().int().min(15).max(480).optional(),
  scheduledStart: z.string().datetime(),
  // wallet = hold from the PayPal-funded wallet (default); paypal = authorize directly at PayPal
  fundingSource: z.enum(['wallet', 'paypal']).optional().default('wallet'),
}).refine((b) => b.packageId || b.durationMin, { message: 'Choose a package or a duration' });

const cancelBookingSchema = z.object({
  reason: z.string().optional(),
});

const listBookingsSchema = z.object({
  status: z.enum(['pending', 'authorized', 'in_progress', 'completed', 'cancelled', 'no_show', 'disputed']).optional(),
  role: z.enum(['driver', 'host']).optional().default('driver'),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be 1 to 5').max(5, 'Rating must be 1 to 5'),
  reviewText: z.string().max(1000, 'Review must be 1000 characters or less').optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'active', 'completed', 'cancelled']),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * POST /api/bookings
 * Create a new booking
 */
router.post('/', authenticate, requireRole('driver'), validateBody(createBookingSchema), async (req, res, next) => {
  try {
    const result = await bookingService.createBooking({
      driverId: req.user.id,
      chargerId: req.body.chargerId,
      packageId: req.body.packageId,
      durationMin: req.body.durationMin,
      scheduledStart: req.body.scheduledStart,
      fundingSource: req.body.fundingSource,
      frontendUrl: config.frontendUrl,
    });

    // Audit log for booking creation
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.BOOKING_CREATE,
      resource: 'booking',
      resourceId: result.booking?.id,
      details: {
        chargerId: req.body.chargerId,
        packageId: req.body.packageId,
        durationMin: req.body.durationMin,
        scheduledStart: req.body.scheduledStart,
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
 * GET /api/bookings
 * Get user's bookings
 */
router.get('/', authenticate, validateQuery(listBookingsSchema), async (req, res, next) => {
  try {
    // Determine role - use query param if provided, otherwise default based on user roles
    let role = req.query.role;
    if (!role) {
      role = req.user.roles.includes('host') ? 'host' : 'driver';
    }

    // Verify user has the requested role
    if (!req.user.roles.includes(role)) {
      role = req.user.roles[0];
    }

    const result = await bookingService.getUserBookings(req.user.id, role, {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });

    paginatedResponse(res, result.bookings, result.pagination);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/host
 * Get host's bookings (bookings for chargers owned by the host)
 */
router.get('/host', authenticate, requireRole('host'), validateQuery(listBookingsSchema), async (req, res, next) => {
  try {
    const result = await bookingService.getHostBookings(req.user.id, {
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });

    paginatedResponse(res, result.bookings, result.pagination);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/:id
 * Get booking by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id, req.user.id, req.user.roles);
    successResponse(res, { booking });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/review
 * Driver reviews the charger, or host reviews the driver.
 * Booking must be completed; each side may review once. Side and role are checked in the service.
 */
router.post('/:id/review', authenticate, requireRole('driver', 'host'), validateBody(reviewSchema), async (req, res, next) => {
  try {
    const result = await bookingService.submitReview(req.params.id, req.user, req.body);

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.RATING_SUBMIT,
      bookingId: req.params.id,
      resource: 'booking',
      resourceId: req.params.id,
      details: { target: result.target, rating: req.body.rating },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/authorize
 * Authorize payment after PayPal approval
 */
router.post('/:id/authorize', authenticate, async (req, res, next) => {
  try {
    const result = await bookingService.authorizeBooking(req.params.id, req.user.id);

    // Audit log for payment authorization
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.PAYMENT_AUTHORIZE,
      resource: 'booking',
      resourceId: req.params.id,
      details: { status: 'authorized' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/cancel
 * Cancel a booking
 */
router.post('/:id/cancel', authenticate, validateBody(cancelBookingSchema), async (req, res, next) => {
  try {
    const result = await bookingService.cancelBooking(
      req.params.id,
      req.user.id,
      req.body.reason
    );

    // Audit log for booking cancellation
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.BOOKING_CANCEL,
      resource: 'booking',
      resourceId: req.params.id,
      details: { reason: req.body.reason || 'No reason provided' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Update booking status (for hosts to confirm/complete bookings)
 */
router.patch('/:id/status', authenticate, requireRole('host'), validateBody(updateStatusSchema), async (req, res, next) => {
  try {
    const result = await bookingService.updateBookingStatus(
      req.params.id,
      req.user.id,
      req.body.status
    );

    // Audit log for status update
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.BOOKING_STATUS_UPDATE,
      resource: 'booking',
      resourceId: req.params.id,
      details: { newStatus: req.body.status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
