import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { paypalService } from './paypal.service.js';
import { walletService } from './wallet.service.js';
import { 
  NotFoundError, 
  ValidationError, 
  ForbiddenError 
} from '../utils/errors.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Decide how a session went. Pure: reads the booking and the device events, touches nothing.
 * Returns { outcome: 'success' | 'failed' | 'pending', reason?, amount?, durationMin?, energyKwh? }.
 *
 * - manual: both sides vouched for it, so it is a success for the full booked amount.
 * - device: the charger's signed events decide.
 *   success = unlocked + ran at least minSessionMinutes + (if metered) real energy. Paid by the share
 *   of the booked time that was used.
 *   failed  = never unlocked, too short, or a meter reading of about zero. Full refund.
 */
export function evaluateSession({ proofSource = 'manual', booking, events = [], now = new Date(), cfg = config.device }) {
  const total = Number(booking.totalAmount);
  if (proofSource !== 'device') return { outcome: 'success', amount: total };

  const start = new Date(booking.scheduledStart).getTime();
  const end = new Date(booking.scheduledEnd).getTime();
  const windowEnd = end + cfg.graceMinutes * 60000;
  const unlocked = events.find((e) => e.type === 'unlocked');
  const ended = [...events].reverse().find((e) => e.type === 'ended');

  if (!unlocked) {
    return now.getTime() > windowEnd ? { outcome: 'failed', reason: 'no_unlock' } : { outcome: 'pending' };
  }

  let durationMin;
  let energyKwh = null;
  if (ended) {
    durationMin = Number(ended.payload?.durationMin);
    if (ended.payload?.energyKwh !== undefined && ended.payload?.energyKwh !== null) energyKwh = Number(ended.payload.energyKwh);
  } else if (now.getTime() > windowEnd) {
    // The device never said "ended": close at the booked end, using the last meter reading
    const lastMeter = [...events].reverse().find((e) => e.type === 'meter');
    durationMin = Math.max(0, (end - new Date(unlocked.createdAt).getTime()) / 60000);
    if (lastMeter?.payload?.kwh !== undefined) energyKwh = Number(lastMeter.payload.kwh);
  } else {
    return { outcome: 'pending' };
  }

  if (!Number.isFinite(durationMin) || durationMin < 0) return { outcome: 'failed', reason: 'invalid_report' };
  if (durationMin < cfg.minSessionMinutes) return { outcome: 'failed', reason: 'too_short', durationMin, energyKwh };
  if (energyKwh !== null && (!Number.isFinite(energyKwh) || energyKwh < cfg.minEnergyKwh)) {
    return { outcome: 'failed', reason: 'meter_anomaly', durationMin, energyKwh };
  }

  const bookedMin = (end - start) / 60000;
  const used = bookedMin > 0 ? Math.min(1, durationMin / bookedMin) : 1;
  return { outcome: 'success', amount: round2(total * used), durationMin: Math.ceil(durationMin), energyKwh };
}

export const sessionService = {
  /**
   * Settle a wallet-funded booking once evaluateSession has decided. Both the manual and the device
   * path end here, so the money moves the same way. Returns false when another call settled it first.
   *
   * success: driver pays `amount` (the unused part of the hold goes back), host is credited minus the
   *          platform fee, now or after config.payout.delayHours.
   * failed:  the whole hold goes back to the driver and the booking is cancelled.
   */
  async settleWalletSession(booking, evaluation, { endedAt = new Date(), durationMin = null, energyKwh = null, confirmations = {}, proofSource = 'manual' } = {}) {
    const bookingId = booking.id;
    const total = Number(booking.totalAmount);
    const success = evaluation.outcome === 'success';
    const delayMs = config.payout.delayHours * 3600 * 1000;

    return prisma.$transaction(async (tx) => {
      // Never release or refund money that was not held (for example a booking made by the seed script)
      await walletService.assertHold(tx, bookingId);

      const claim = await tx.booking.updateMany({
        where: { id: bookingId, status: { in: ['in_progress', 'authorized'] } },
        data: success
          ? { status: 'completed' }
          : { status: 'cancelled', cancelledAt: endedAt, cancellationReason: `Charging not delivered: ${evaluation.reason}` },
      });
      if (claim.count === 0) return false;

      if (!success) {
        await walletService.returnHold(tx, booking.driverId, total, bookingId, `Refund: charging not delivered (${evaluation.reason})`);
        await tx.session.update({
          where: { id: booking.session.id },
          data: { actualEnd: endedAt, actualDurationMin: durationMin, energyKwh, proofSource, status: 'ended', outcome: `failed:${evaluation.reason}` },
        });
        await tx.payment.update({ where: { id: booking.payment.id }, data: { status: 'voided', refundedAmount: total, refundedAt: endedAt } });
        return true;
      }

      const amount = evaluation.amount;
      const fee = amount * config.platform.feePercent / 100;
      const hostAmount = amount - fee;
      const deferHost = delayMs > 0;
      await walletService.release(tx, {
        driverId: booking.driverId,
        hostId: booking.charger.hostId,
        heldAmount: total,
        chargedAmount: amount,
        hostAmount,
        bookingId,
        deferHost,
      });
      await tx.session.update({
        where: { id: booking.session.id },
        data: {
          actualEnd: endedAt,
          actualDurationMin: durationMin,
          ...confirmations,
          finalAmount: amount,
          energyKwh,
          proofSource,
          status: 'ended',
          outcome: 'success',
        },
      });
      await tx.payment.update({
        where: { id: booking.payment.id },
        data: {
          capturedAmount: amount,
          capturedAt: endedAt,
          hostPayoutAmount: hostAmount,
          platformFeeAmount: fee,
          payoutAt: deferHost ? null : endedAt,
          releaseAfter: deferHost ? new Date(endedAt.getTime() + delayMs) : null,
          status: 'captured',
        },
      });
      await tx.charger.update({ where: { id: booking.chargerId }, data: { totalBookings: { increment: 1 } } });
      return true;
    });
  },

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

    // Same call twice: answer again, release nothing a second time
    if (booking.status === 'completed' && booking.payment?.status === 'captured') {
      return {
        session: {
          actualStart: booking.session?.actualStart,
          actualEnd: booking.session?.actualEnd,
          actualDurationMin: booking.session?.actualDurationMin,
          status: 'ended',
        },
        payment: {
          capturedAmount: booking.payment.capturedAmount ? parseFloat(booking.payment.capturedAmount) : null,
          hostPayout: booking.payment.hostPayoutAmount ? parseFloat(booking.payment.hostPayoutAmount) : null,
          platformFee: booking.payment.platformFeeAmount ? parseFloat(booking.payment.platformFeeAmount) : null,
          payoutStatus: booking.payment.fundingSource === 'wallet' ? 'credited_to_host_wallet' : (booking.payment.paypalPayoutId ? 'sent' : 'pending_email'),
          payoutSimulated: false,
        },
        alreadyCompleted: true,
        message: 'Session was already completed. Payment was released earlier.',
      };
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

    // Wallet-funded booking: release the escrow to the host's wallet. The host can withdraw it to PayPal later.
    if (booking.payment.fundingSource === 'wallet') {
      // Both the manual and the device path settle through settleWalletSession
      const evaluation = evaluateSession({ proofSource: 'manual', booking, now });
      const settled = await this.settleWalletSession(booking, evaluation, {
        endedAt: now,
        durationMin: actualDurationMin,
        confirmations: {
          driverEndConfirm: isDriver ? now : booking.session.driverEndConfirm,
          hostEndConfirm: isHost ? now : booking.session.hostEndConfirm,
        },
      });

      if (!settled) {
        return this.endSession(bookingId, userId, confirmedBy);
      }

      const walletFee = evaluation.amount * config.platform.feePercent / 100;
      const delayed = config.payout.delayHours > 0;
      return {
        session: { actualStart, actualEnd: now, actualDurationMin, status: 'ended' },
        payment: {
          capturedAmount: evaluation.amount,
          hostPayout: evaluation.amount - walletFee,
          platformFee: walletFee,
          payoutStatus: delayed ? 'pending_release' : 'credited_to_host_wallet',
          payoutSimulated: false,
        },
        message: delayed
          ? `Session completed! Payment will reach the host wallet after ${config.payout.delayHours} hours.`
          : 'Session completed! Payment released to the host wallet.',
      };
    }

    // Claim the booking first so a second call cannot capture twice
    const claim = await prisma.booking.updateMany({
      where: { id: bookingId, status: 'in_progress' },
      data: { status: 'completed' },
    });
    if (claim.count === 0) {
      return this.endSession(bookingId, userId, confirmedBy);
    }

    // Capture payment; if PayPal refuses, open the booking again so the call can be retried
    let captureResult;
    try {
      captureResult = await paypalService.captureAuthorization(
        booking.payment.paypalAuthId,
        finalAmount,
        booking.currency,
        true
      );
    } catch (error) {
      await prisma.booking.updateMany({ where: { id: bookingId, status: 'completed' }, data: { status: 'in_progress' } });
      throw error;
    }

    // Calculate host payout
    const platformFeeAmount = finalAmount * config.platform.feePercent / 100;
    const hostPayoutAmount = finalAmount - platformFeeAmount;

    // Create payout to host (if PayPal email configured)
    let payoutResult = null;
    let payoutFailed = false;
    if (booking.charger.host.paypalEmail) {
      try {
        payoutResult = await paypalService.createPayout({
          recipientEmail: booking.charger.host.paypalEmail,
          amount: hostPayoutAmount,
          currency: booking.currency,
          note: `Payment for EV charging session - Booking ${bookingId}`,
          bookingId,
        });
      } catch (error) {
        // The money is captured; keep the record and flag the payout instead of losing the capture
        payoutFailed = true;
        console.error(`Host payout failed for booking ${bookingId}:`, error.message);
      }
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
        payoutStatus: payoutFailed ? 'failed' : (payoutResult?.status || 'pending_email'),
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
