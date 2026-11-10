import { Router } from 'express';

import { prisma } from '../utils/prisma.js';
import { paypalService } from '../services/paypal.service.js';
import { config } from '../config/index.js';

const router = Router();

// ===========================================
// PAYPAL WEBHOOKS
// ===========================================

/**
 * POST /api/webhooks/paypal
 * Handle PayPal webhook events
 */
router.post('/paypal', async (req, res) => {
  try {
    // Parse the raw body
    const body = JSON.parse(req.body.toString());

    // Verify webhook signature (in production)
    if (config.nodeEnv === 'production' && config.paypal.webhookId) {
      const isValid = await paypalService.verifyWebhookSignature(req.headers, body);
      if (!isValid) {
        console.error('Invalid PayPal webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const eventType = body.event_type;
    const resource = body.resource;

    console.log(`PayPal Webhook: ${eventType}`, resource?.id);

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
        // Order approved by buyer - we'll authorize it when they return
        console.log('Order approved:', resource.id);
        break;

      case 'PAYMENT.AUTHORIZATION.CREATED':
        // Authorization created
        await handleAuthorizationCreated(resource);
        break;

      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment captured
        await handleCaptureCompleted(resource);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        // Capture denied
        await handleCaptureDenied(resource);
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        // Refund completed
        await handleRefundCompleted(resource);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle authorization created event
 */
async function handleAuthorizationCreated(resource) {
  const authId = resource.id;

  // Find payment by order ID
  // The order ID is in the supplementary_data or we need to look it up
  const orderId = resource.supplementary_data?.related_ids?.order_id;

  if (orderId) {
    await prisma.payment.updateMany({
      where: { paypalOrderId: orderId },
      data: {
        paypalAuthId: authId,
        status: 'authorized',
        authorizedAt: new Date(),
      },
    });
  }
}

/**
 * Handle capture completed event
 */
async function handleCaptureCompleted(resource) {
  const captureId = resource.id;
  const authId = resource.supplementary_data?.related_ids?.authorization_id;

  if (authId) {
    await prisma.payment.updateMany({
      where: { paypalAuthId: authId },
      data: {
        paypalCaptureId: captureId,
        capturedAmount: parseFloat(resource.amount.value),
        status: 'captured',
        capturedAt: new Date(),
      },
    });
  }
}

/**
 * Handle capture denied event
 */
async function handleCaptureDenied(resource) {
  const authId = resource.supplementary_data?.related_ids?.authorization_id;

  if (authId) {
    await prisma.payment.updateMany({
      where: { paypalAuthId: authId },
      data: { status: 'failed' },
    });

    // Also update booking
    const payment = await prisma.payment.findFirst({
      where: { paypalAuthId: authId },
    });

    if (payment) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'cancelled' },
      });
    }
  }
}

/**
 * Handle refund completed event
 */
async function handleRefundCompleted(resource) {
  const captureId = resource.supplementary_data?.related_ids?.capture_id;
  const refundAmount = parseFloat(resource.amount.value);

  if (captureId) {
    const payment = await prisma.payment.findFirst({
      where: { paypalCaptureId: captureId },
    });

    if (payment) {
      const currentRefunded = parseFloat(payment.refundedAmount) || 0;
      const newRefunded = currentRefunded + refundAmount;
      const captured = parseFloat(payment.capturedAmount) || 0;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: newRefunded,
          status: newRefunded >= captured ? 'refunded' : 'partially_refunded',
          refundedAt: new Date(),
        },
      });
    }
  }
}

export default router;
