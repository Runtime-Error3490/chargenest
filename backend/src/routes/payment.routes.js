import { Router } from 'express';

import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const router = Router();

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/payments/:bookingId
 * Get payment details for a booking
 */
router.get('/:bookingId', authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: {
        charger: { select: { hostId: true } },
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check access
    const isDriver = booking.driverId === req.user.id;
    const isHost = booking.charger.hostId === req.user.id;
    const isAdmin = req.user.roles.includes('admin');

    if (!isDriver && !isHost && !isAdmin) {
      throw new ForbiddenError('You do not have access to this payment');
    }

    if (!booking.payment) {
      throw new NotFoundError('Payment');
    }

    const payment = booking.payment;

    successResponse(res, {
      payment: {
        id: payment.id,
        bookingId: payment.bookingId,
        status: payment.status,
        currency: payment.currency,
        authorizedAmount: payment.authorizedAmount ? parseFloat(payment.authorizedAmount) : null,
        capturedAmount: payment.capturedAmount ? parseFloat(payment.capturedAmount) : null,
        refundedAmount: payment.refundedAmount ? parseFloat(payment.refundedAmount) : null,
        hostPayoutAmount: isHost || isAdmin ? (payment.hostPayoutAmount ? parseFloat(payment.hostPayoutAmount) : null) : undefined,
        platformFeeAmount: isAdmin ? (payment.platformFeeAmount ? parseFloat(payment.platformFeeAmount) : null) : undefined,
        authorizedAt: payment.authorizedAt,
        capturedAt: payment.capturedAt,
        refundedAt: payment.refundedAt,
        payoutAt: payment.payoutAt,
        // PayPal IDs only for admin
        paypalOrderId: isAdmin ? payment.paypalOrderId : undefined,
        paypalCaptureId: isAdmin ? payment.paypalCaptureId : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/history
 * Get payment history for current user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { role = 'driver', page = 1, limit = 20 } = req.query;

    const where = role === 'driver'
      ? { booking: { driverId: req.user.id } }
      : { booking: { charger: { hostId: req.user.id } } };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              scheduledStart: true,
              charger: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.payment.count({ where }),
    ]);

    successResponse(res, {
      payments: payments.map(p => ({
        id: p.id,
        bookingId: p.bookingId,
        chargerName: p.booking.charger.name,
        scheduledStart: p.booking.scheduledStart,
        status: p.status,
        amount: role === 'driver'
          ? (p.capturedAmount ? parseFloat(p.capturedAmount) : parseFloat(p.authorizedAmount))
          : (p.hostPayoutAmount ? parseFloat(p.hostPayoutAmount) : null),
        currency: p.currency,
        createdAt: p.createdAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
