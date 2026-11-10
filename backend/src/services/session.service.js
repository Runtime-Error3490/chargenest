import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { paypalService } from './paypal.service.js';
import { 
  NotFoundError, 
  ValidationError, 
  ForbiddenError 
} from '../utils/errors.js';

export const sessionService = {
  /**
   * Confirm session start (called by driver or host)
   */
  async confirmStart(bookingId, userId, confirmedBy) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: { select: { hostId: true } },
        session: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check authorization
    const isDriver = booking.driverId === userId;
    const isHost = booking.charger.hostId === userId;

    if (!isDriver && !isHost) {
      throw new ForbiddenError('You are not part of this booking');
    }

    if (booking.status !== 'authorized') {
      throw new ValidationError(`Cannot start session for booking with status: ${booking.status}`);
    }

    if (!booking.session) {
      throw new ValidationError('Session not initialized');
    }

    // Determine which confirmation this is
    const updateData = {};
    const now = new Date();

    if (confirmedBy === 'driver' && isDriver) {
      if (booking.session.driverStartConfirm) {
        throw new ValidationError('Driver already confirmed start');
      }
      updateData.driverStartConfirm = now;
    } else if (confirmedBy === 'host' && isHost) {
      if (booking.session.hostStartConfirm) {
        throw new ValidationError('Host already confirmed start');
      }
      updateData.hostStartConfirm = now;
    } else {
      throw new ForbiddenError('Invalid confirmation');
    }

    // Check if both have now confirmed
    const driverConfirmed = booking.session.driverStartConfirm || updateData.driverStartConfirm;
    const hostConfirmed = booking.session.hostStartConfirm || updateData.hostStartConfirm;

    if (driverConfirmed && hostConfirmed) {
      updateData.status = 'in_progress';
      updateData.actualStart = now;
    } else if (updateData.driverStartConfirm) {
      updateData.status = 'driver_confirmed';
    } else {
      updateData.status = 'host_confirmed';
    }

    // Update session
    const session = await prisma.session.update({
      where: { id: booking.session.id },
      data: updateData,
    });

    // Update booking status if session started
    if (session.status === 'in_progress') {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'in_progress' },
      });
    }

    return {
      session: {
        id: session.id,
        bookingId: session.bookingId,
        status: session.status,
        driverStartConfirm: session.driverStartConfirm,
        hostStartConfirm: session.hostStartConfirm,
        actualStart: session.actualStart,
      },
      message: session.status === 'in_progress'
        ? 'Session started! Both parties confirmed.'
        : `Waiting for ${confirmedBy === 'driver' ? 'host' : 'driver'} confirmation`,
    };
  },

  /**
   * End session (called by driver or host, triggers capture)
   */
  async endSession(bookingId, userId, confirmedBy) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: { 
          select: { 
            hostId: true,
            host: { select: { paypalEmail: true } },
          },
        },
        session: true,
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check authorization
    const isDriver = booking.driverId === userId;
    const isHost = booking.charger.hostId === userId;

    if (!isDriver && !isHost) {
      throw new ForbiddenError('You are not part of this booking');
    }

    if (booking.status !== 'in_progress') {
      throw new ValidationError(`Cannot end session for booking with status: ${booking.status}`);
    }

    if (!booking.session || booking.session.status !== 'in_progress') {
      throw new ValidationError('Session is not in progress');
    }

    // Calculate actual duration
    const now = new Date();
    const actualStart = new Date(booking.session.actualStart);
    const actualDurationMs = now - actualStart;
    const actualDurationMin = Math.ceil(actualDurationMs / (1000 * 60));

    // For MVP, charge the full amount (time-based packages are pre-paid)
    const finalAmount = parseFloat(booking.totalAmount);

    // Capture payment
    const captureResult = await paypalService.captureAuthorization(
      booking.payment.paypalAuthId,
      finalAmount,
      booking.currency,
      true
    );

    // Calculate host payout
    const platformFeeAmount = finalAmount * config.platform.feePercent / 100;
    const hostPayoutAmount = finalAmount - platformFeeAmount;

    // Create payout to host (if PayPal email configured)
    let payoutResult = null;
    if (booking.charger.host.paypalEmail) {
      payoutResult = await paypalService.createPayout({
        recipientEmail: booking.charger.host.paypalEmail,
        amount: hostPayoutAmount,
        currency: booking.currency,
        note: `Payment for EV charging session - Booking ${bookingId}`,
        bookingId,
      });
    }

    // Update records
    await prisma.$transaction([
      prisma.session.update({
        where: { id: booking.session.id },
        data: {
          actualEnd: now,
          actualDurationMin,
          driverEndConfirm: isDriver ? now : booking.session.driverEndConfirm,
          hostEndConfirm: isHost ? now : booking.session.hostEndConfirm,
          finalAmount,
          status: 'ended',
        },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'completed' },
      }),
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          paypalCaptureId: captureResult.captureId,
          capturedAmount: finalAmount,
          capturedAt: now,
          hostPayoutAmount,
          platformFeeAmount,
          paypalPayoutId: payoutResult?.payoutBatchId,
          payoutAt: payoutResult ? now : null,
          status: 'captured',
        },
      }),
      // Increment charger booking count
      prisma.charger.update({
        where: { id: booking.chargerId },
        data: { totalBookings: { increment: 1 } },
      }),
    ]);

    return {
      session: {
        actualStart: actualStart,
        actualEnd: now,
        actualDurationMin,
        status: 'ended',
      },
      payment: {
        capturedAmount: finalAmount,
        hostPayout: hostPayoutAmount,
        platformFee: platformFeeAmount,
        payoutStatus: payoutResult?.status || 'pending_email',
        payoutSimulated: payoutResult?.simulated || false,
      },
      message: 'Session completed! Payment captured and host payout initiated.',
    };
  },

  /**
   * Get session details
   */
  async getSession(bookingId, userId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: { select: { hostId: true } },
        session: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check authorization
    const isDriver = booking.driverId === userId;
    const isHost = booking.charger.hostId === userId;

    if (!isDriver && !isHost) {
      throw new ForbiddenError('You are not part of this booking');
    }

    if (!booking.session) {
      return {
        session: null,
        message: 'Session not yet created. Authorize the booking first.',
      };
    }

    return {
      session: {
        id: booking.session.id,
        bookingId: booking.session.bookingId,
        status: booking.session.status,
        driverStartConfirm: booking.session.driverStartConfirm,
        hostStartConfirm: booking.session.hostStartConfirm,
        actualStart: booking.session.actualStart,
        actualEnd: booking.session.actualEnd,
        actualDurationMin: booking.session.actualDurationMin,
        finalAmount: booking.session.finalAmount ? parseFloat(booking.session.finalAmount) : null,
      },
    };
  },
};

export default sessionService;
