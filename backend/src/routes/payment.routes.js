import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { walletService } from '../services/wallet.service.js';
import { invoiceService } from '../services/invoice.service.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const topUpSchema = z.object({
  amount: z.number()
    .min(1, 'Minimum top-up is 1')
    .max(100000, 'Maximum top-up is 100000')
    // At most 2 decimals, like a currency amount
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use at most 2 decimal places'),
});
const captureTopUpSchema = z.object({ orderId: z.string().min(1) });
const withdrawSchema = z.object({ amount: z.number().positive().max(100000) });
const createInvoiceSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().min(5).max(500),
});

// ===========================================
// WALLET AND INVOICES (declared before /:bookingId)
// ===========================================

/**
 * GET /api/payments/wallet
 * Balance, held escrow, deposit status and recent ledger
 */
router.get('/wallet', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await walletService.getWallet(req.user.id));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/wallet/topup
 * Create a PayPal order; the user approves it at PayPal
 */
router.post('/wallet/topup', authenticate, validateBody(topUpSchema), async (req, res, next) => {
  try {
    successResponse(res, await walletService.startTopUp(req.user.id, req.body.amount), 201);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/wallet/topup/capture
 * After PayPal approval, capture the order and credit the wallet
 */
router.post('/wallet/topup/capture', authenticate, validateBody(captureTopUpSchema), async (req, res, next) => {
  try {
    successResponse(res, await walletService.completeTopUp(req.user.id, req.body.orderId));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/wallet/withdraw
 * Pay spendable balance (above the deposit) out to the user's PayPal email
 */
router.post('/wallet/withdraw', authenticate, validateBody(withdrawSchema), async (req, res, next) => {
  try {
    successResponse(res, await walletService.withdraw(req.user.id, req.body.amount));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/wallet/close
 * Pay out the whole wallet, deposit included. Blocked while bookings, disputes or invoices are open.
 */
router.post('/wallet/close', authenticate, async (req, res, next) => {
  try {
    successResponse(res, await walletService.closeWallet(req.user.id));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/invoices
 * Invoices the user issued or received
 */
router.get('/invoices', authenticate, async (req, res, next) => {
  try {
    successResponse(res, { invoices: await invoiceService.listForUser(req.user.id) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/invoices
 * Host sends a PayPal invoice to the driver (for example for damage)
 */
router.post('/invoices', authenticate, requireRole('host'), validateBody(createInvoiceSchema), async (req, res, next) => {
  try {
    successResponse(res, { invoice: await invoiceService.createDamageInvoice(req.user.id, req.body) }, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/invoices/:id/refresh
 * Check PayPal for the invoice status
 */
router.post('/invoices/:id/refresh', authenticate, async (req, res, next) => {
  try {
    successResponse(res, { invoice: await invoiceService.refresh(req.params.id, req.user.id) });
  } catch (error) {
    next(error);
  }
});

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
