import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { sessionService, evaluateSession } from './session.service.js';
import { walletService } from './wallet.service.js';
import { createAuditLog } from './audit.service.js';
import { AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * Charger hardware (ESP32 + relay + meter). It proves a charging session with signed events:
 *   unlocked -> meter (any number) -> ended
 * The backend decides the outcome (evaluateSession) and moves the money (settleWalletSession).
 * The mock device below sends the same signed events through the same handler, so swapping in real
 * hardware changes the sender and nothing else.
 */

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const canonical = (value) => JSON.stringify(value, (_k, v) =>
  (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {})
    : v);

/**
 * Signature the device must send: HMAC-SHA256 over every field that matters.
 */
export function signEvent(secret, { deviceId, bookingId, type, counter, ts, payload = {} }) {
  return crypto
    .createHmac('sha256', secret)
    .update([deviceId, bookingId, type, counter, ts, canonical(payload)].join('.'))
    .digest('hex');
}

function signatureMatches(expected, given) {
  const a = Buffer.from(expected);
  const b = Buffer.from(String(given || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const bookingInclude = {
  charger: { select: { hostId: true } },
  session: true,
  payment: true,
};

export const deviceService = {
  /**
   * Host registers the hardware on one of their chargers. The secret is shown once.
   */
  async register(userId, chargerId) {
    const charger = await prisma.charger.findUnique({ where: { id: chargerId }, select: { hostId: true } });
    if (!charger) throw new NotFoundError('Charger');
    if (charger.hostId !== userId) throw new ForbiddenError('You can only register a device on your own charger');
    const existing = await prisma.device.findUnique({ where: { chargerId } });
    if (existing) throw new ConflictError('DEVICE_ALREADY_REGISTERED', 'This charger already has a device');

    const device = await prisma.device.create({
      data: { chargerId, secret: crypto.randomBytes(24).toString('hex') },
    });
    return { deviceId: device.id, secret: device.secret };
  },

  /**
   * Accept one signed event from a device and act on it.
   */
  async handleEvent({ deviceId, bookingId, type, counter, ts, payload = {}, signature }, now = new Date()) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.status !== 'active') {
      throw new AuthError('DEVICE_UNKNOWN', 'Unknown or inactive device');
    }
    const expected = signEvent(device.secret, { deviceId, bookingId, type, counter, ts, payload });
    if (!signatureMatches(expected, signature)) {
      throw new AuthError('DEVICE_BAD_SIGNATURE', 'Event signature does not match');
    }
    if (Math.abs(now.getTime() - ts) > MAX_CLOCK_SKEW_MS) {
      throw new ValidationError('Event time is too far from server time');
    }

    const last = await prisma.deviceEvent.findFirst({ where: { deviceId }, orderBy: { counter: 'desc' } });
    if (last && counter <= last.counter) {
      throw new ConflictError('DEVICE_REPLAY', 'Event counter must be higher than the last one');
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
    if (!booking) throw new NotFoundError('Booking');
    if (booking.chargerId !== device.chargerId) throw new ForbiddenError('This device does not belong to that booking');
    if (booking.payment?.fundingSource !== 'wallet') {
      throw new ValidationError('Device sessions support wallet bookings only');
    }
    // Check before unlocking, so a booking with no hold is not left half-started
    if (type === 'unlocked') await walletService.assertHold(prisma, bookingId);
    // Bookings made outside the normal flow (seed data) can lack a session row
    if (!booking.session) {
      booking.session = await prisma.session.create({ data: { bookingId, status: 'awaiting_start' } });
    }

    const expectedStatus = type === 'unlocked' ? 'authorized' : 'in_progress';
    if (booking.status !== expectedStatus) {
      throw new ValidationError(`Cannot accept "${type}" for a booking with status: ${booking.status}`);
    }
    if (type !== 'unlocked' && booking.session?.proofSource !== 'device') {
      throw new ValidationError('This session was not started by the device');
    }

    // Unique (device, counter) also stops two identical events racing in
    await prisma.deviceEvent.create({ data: { deviceId, bookingId, type, counter, payload } });
    await prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: now } });

    await createAuditLog({
      action: `device_${type}`,
      bookingId,
      details: { deviceId, counter, ...(type === 'ended' ? payload : {}) },
    });

    if (type === 'unlocked') {
      await prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: booking.session.id },
          data: { status: 'in_progress', actualStart: now, proofSource: 'device' },
        });
        await tx.booking.update({ where: { id: bookingId }, data: { status: 'in_progress' } });
      });
      return { accepted: true, session: 'in_progress' };
    }

    if (type === 'meter') return { accepted: true };

    // ended
    const result = await this.closeSession(booking, now);
    return { accepted: true, ...result };
  },

  /**
   * Evaluate a device-proven booking and settle it if the outcome is decided.
   */
  async closeSession(booking, now = new Date()) {
    const events = await prisma.deviceEvent.findMany({ where: { bookingId: booking.id }, orderBy: { counter: 'asc' } });
    const evaluation = evaluateSession({ proofSource: 'device', booking, events, now });
    if (evaluation.outcome === 'pending') return { outcome: 'pending' };

    const settled = await sessionService.settleWalletSession(booking, evaluation, {
      endedAt: now,
      durationMin: evaluation.durationMin ?? null,
      energyKwh: evaluation.energyKwh ?? null,
      proofSource: 'device',
    });
    return {
      outcome: settled ? evaluation.outcome : 'already_settled',
      reason: evaluation.reason,
      amount: evaluation.amount,
    };
  },

  /**
   * Background work, safe to run often:
   * 1. Close device bookings whose time is over (never unlocked -> refund, never ended -> close at booked end).
   * 2. Credit hosts whose payout delay has passed (skips bookings under dispute).
   * With bookingId only step 1 runs, for that booking (used by the mock).
   */
  async sweep({ now = new Date(), bookingId = null } = {}) {
    const cutoff = new Date(now.getTime() - config.device.graceMinutes * 60000);
    const due = await prisma.booking.findMany({
      where: {
        status: { in: ['authorized', 'in_progress'] },
        scheduledEnd: { lt: cutoff },
        charger: { device: { isNot: null } },
        payment: { fundingSource: 'wallet' },
        ...(bookingId && { id: bookingId }),
      },
      include: bookingInclude,
    });

    let closed = 0;
    for (const booking of due) {
      // Sessions started by hand keep their manual flow
      if (booking.status === 'in_progress' && booking.session?.proofSource !== 'device') continue;
      try {
        const result = await this.closeSession(booking, now);
        if (result.outcome === 'success' || result.outcome === 'failed') closed += 1;
      } catch (error) {
        console.error(`Could not close device booking ${booking.id}:`, error.message);
      }
    }
    if (bookingId) return { closed, paid: 0 };

    const payments = await prisma.payment.findMany({
      where: {
        releasedAt: null,
        releaseAfter: { lte: now },
        status: { in: ['captured', 'partially_refunded'] },
        booking: { status: { not: 'disputed' } },
      },
      include: { booking: { select: { id: true, charger: { select: { hostId: true } } } } },
    });

    let paid = 0;
    for (const payment of payments) {
      const amount = payment.hostPayoutAmount ? parseFloat(payment.hostPayoutAmount) : 0;
      try {
        const done = await prisma.$transaction(async (tx) => {
          const claim = await tx.payment.updateMany({
            where: { id: payment.id, releasedAt: null },
            data: { releasedAt: now, payoutAt: now },
          });
          if (claim.count === 0) return false;
          if (amount > 0) {
            await walletService.releaseToHost(tx, { hostId: payment.booking.charger.hostId, hostAmount: amount, bookingId: payment.booking.id });
          }
          return true;
        });
        if (done) paid += 1;
      } catch (error) {
        console.error(`Could not pay out booking ${payment.booking.id}:`, error.message);
      }
    }
    return { closed, paid };
  },

  /**
   * Mock device. Plays a scenario by sending signed events through handleEvent, the same path real
   * hardware uses. Never available in production.
   */
  async simulate(userId, { bookingId, scenario, durationMin, energyKwh }) {
    if (!config.device.mock) throw new ForbiddenError('Device mock is off. Set DEVICE_MOCK=true (and DEMO_MODE=true in production)');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
    if (!booking) throw new NotFoundError('Booking');
    if (booking.driverId !== userId && booking.charger.hostId !== userId) {
      throw new ForbiddenError('You are not part of this booking');
    }

    // Register a mock device on the charger the first time
    let device = await prisma.device.findUnique({ where: { chargerId: booking.chargerId } });
    if (!device) {
      device = await prisma.device.create({
        data: { chargerId: booking.chargerId, secret: crypto.randomBytes(24).toString('hex') },
      });
    }

    const bookedMin = Math.round((new Date(booking.scheduledEnd) - new Date(booking.scheduledStart)) / 60000);
    const last = await prisma.deviceEvent.findFirst({ where: { deviceId: device.id }, orderBy: { counter: 'desc' } });
    let counter = last ? last.counter : 0;
    const steps = [];

    const send = async (type, payload = {}, { deviceId = device.id, secret = device.secret } = {}) => {
      counter += 1;
      const event = { deviceId, bookingId, type, counter, ts: Date.now(), payload };
      event.signature = signEvent(secret, event);
      try {
        const result = await this.handleEvent(event);
        steps.push({ type, ok: true, ...result });
      } catch (error) {
        steps.push({ type, ok: false, code: error.code || 'ERROR', message: error.message });
      }
    };

    switch (scenario) {
      case 'success':
      case 'short_session':
      case 'bad_meter': {
        const minutes = scenario === 'short_session' ? 1 : (durationMin ?? bookedMin);
        const kwh = scenario === 'bad_meter' ? 0 : (energyKwh ?? Math.round((minutes / 60) * 7 * 100) / 100);
        await send('unlocked');
        await send('meter', { kwh: Math.round(kwh / 2 * 100) / 100, powerKw: 7 });
        await send('ended', { durationMin: minutes, energyKwh: kwh });
        break;
      }
      case 'fake_station':
        // A device nobody registered, signing with a key we never issued
        await send('unlocked', {}, { deviceId: crypto.randomUUID(), secret: 'not-a-real-key' });
        break;
      case 'offline':
      case 'no_unlock': {
        // Nothing arrives. Jump to the end of the booking window and let the sweep close it.
        const later = new Date(new Date(booking.scheduledEnd).getTime() + (config.device.graceMinutes + 1) * 60000);
        const swept = await this.sweep({ now: later, bookingId });
        steps.push({ type: 'sweep', ok: true, ...swept });
        break;
      }
      default:
        throw new ValidationError(`Unknown scenario: ${scenario}`);
    }

    const [after, session] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } }),
      prisma.session.findUnique({ where: { bookingId }, select: { status: true, outcome: true, finalAmount: true } }),
    ]);
    return { scenario, steps, booking: after, session };
  },
};

/**
 * Start the background runner. Does nothing in tests or when JOB_INTERVAL_SEC=0.
 */
export function startJobs() {
  const seconds = config.device.jobIntervalSec;
  if (!(seconds > 0) || process.env.NODE_ENV === 'test') return null;
  const timer = setInterval(() => {
    deviceService.sweep().catch((error) => console.error('Background sweep failed:', error.message));
  }, seconds * 1000);
  timer.unref();
  return timer;
}
