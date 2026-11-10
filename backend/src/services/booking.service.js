import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { paypalService } from './paypal.service.js';
import { walletService } from './wallet.service.js';
import {
  hourlyRateOf,
  priceForDuration,
  RATE_MIN_DURATION,
  RATE_MAX_DURATION,
  RATE_STEP_MIN,
} from './charger.service.js';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError,
  ForbiddenError 
} from '../utils/errors.js';

// A booking can be reviewed once the charger was actually used
const REVIEWABLE_STATUSES = ['completed', 'disputed'];

/**
 * Decide which side of the booking the user reviews from.
 * Driver must own the booking AND hold the 'driver' role; host must own the
 * charger AND hold the 'host' role. Booking your own charger can't be reviewed.
 */
function getReviewerSide(booking, user) {
  const roles = user.roles || [];
  const isDriver = booking.driverId === user.id;
  const isHost = booking.charger.hostId === user.id;

  if (isDriver && isHost) {
    return { error: 'You cannot review a booking on your own charger' };
  }
  if (isDriver) {
    return roles.includes('driver')
      ? { side: 'driver' }
      : { error: 'Only drivers can review chargers' };
  }
  if (isHost) {
    return roles.includes('host')
      ? { side: 'host' }
      : { error: 'Only hosts can review drivers' };
  }
  return { error: 'Only the driver and host of this booking can review it' };
}

function formatCreatedBooking(booking, { baseAmount, platformFee, totalAmount }) {
  return {
    id: booking.id,
    chargerId: booking.chargerId,
    chargerName: booking.charger.name,
    chargerAddress: booking.charger.address,
    package: {
      name: booking.package.name,
      durationMin: booking.package.durationMin,
    },
    scheduledStart: booking.scheduledStart,
    scheduledEnd: booking.scheduledEnd,
    baseAmount,
    platformFee,
    totalAmount,
    currency: booking.currency,
    status: booking.status,
  };
}

function formatReview(r) {
  return r ? { rating: r.rating, reviewText: r.reviewText, createdAt: r.createdAt } : null;
}

/**
 * Calculate cancellation fee based on time before booking
 */
function calculateCancellationFee(scheduledStart, totalAmount) {
  const now = new Date();
  const hoursBeforeBooking = (new Date(scheduledStart) - now) / (1000 * 60 * 60);

  for (const tier of config.cancellation.tiers) {
    if (hoursBeforeBooking >= tier.hoursBeforeMin && hoursBeforeBooking < tier.hoursBeforeMax) {
      return {
        feePercent: tier.penaltyPercent,
        feeAmount: (totalAmount * tier.penaltyPercent) / 100,
        refundAmount: totalAmount * (100 - tier.penaltyPercent) / 100,
      };
    }
  }

  // Default: full penalty
  return {
    feePercent: 100,
    feeAmount: totalAmount,
    refundAmount: 0,
  };
}

function cancelledReply(booking) {
  const fee = booking.cancellationFee ? parseFloat(booking.cancellationFee) : 0;
  const total = parseFloat(booking.totalAmount);
  return {
    bookingId: booking.id,
    status: 'cancelled',
    cancellationFee: fee,
    refundAmount: total - fee,
    alreadyCancelled: true,
    message: 'Booking was already cancelled. No further money moved.',
  };
}

export const bookingService = {
  /**
   * Package for any duration at the host's hourly rate. Reuses a package with the same length and
   * price, and creates one if there is none, so a booking always points at the price it was made at.
   */
  async packageForDuration(charger, durationMin) {
    if (
      !Number.isInteger(durationMin)
      || durationMin < RATE_MIN_DURATION
      || durationMin > RATE_MAX_DURATION
      || durationMin % RATE_STEP_MIN !== 0
    ) {
      throw new ValidationError(
        `Choose a duration from ${RATE_MIN_DURATION} to ${RATE_MAX_DURATION} minutes in steps of ${RATE_STEP_MIN}`
      );
    }
    const rate = hourlyRateOf(charger.packages);
    if (rate === null) throw new ValidationError('This charger has no hourly rate yet');

    const price = priceForDuration(rate, durationMin);
    const existing = charger.packages.find((p) => p.durationMin === durationMin && Number(p.price) === price);
    if (existing) return existing;

    const hours = durationMin / 60;
    return prisma.timePackage.create({
      data: {
        chargerId: charger.id,
        name: durationMin % 60 === 0 ? `${hours} Hour${hours === 1 ? '' : 's'}` : `${durationMin} min`,
        durationMin,
        price,
        currency: charger.packages[0]?.currency || config.platform.defaultCurrency,
      },
    });
  },

  /**
   * Create a new booking with PayPal authorization
   */
  async createBooking({
    driverId,
    chargerId,
    packageId,
    durationMin,
    scheduledStart,
    mandateId = null,
    bookedByAgent = false,
    fundingSource = 'wallet',
    frontendUrl,
  }) {
    // The wallet minimum balance is the damage deposit; no deposit, no booking
    await walletService.assertDepositMet(driverId, 'book a charger');

    // Get charger and package. With durationMin (and no packageId) the price is worked out
    // from the host's hourly rate instead of picking a fixed package.
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: {
        packages: { where: packageId ? { id: packageId } : { isActive: true } },
        host: { select: { paypalEmail: true } },
      },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    if (charger.status !== 'active') {
      throw new ValidationError('Charger is not available');
    }

    let pkg = packageId ? charger.packages[0] : null;
    if (!packageId) {
      pkg = await this.packageForDuration(charger, durationMin);
      packageId = pkg.id;
    }
    if (!pkg) {
      throw new NotFoundError('Package');
    }

    // Calculate times
    const start = new Date(scheduledStart);
    const end = new Date(start.getTime() + pkg.durationMin * 60 * 1000);

    // Check for booking conflicts
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        chargerId,
        status: { in: ['pending', 'authorized', 'in_progress'] },
        OR: [
          {
            scheduledStart: { lte: start },
            scheduledEnd: { gt: start },
          },
          {
            scheduledStart: { lt: end },
            scheduledEnd: { gte: end },
          },
          {
            scheduledStart: { gte: start },
            scheduledEnd: { lte: end },
          },
        ],
      },
    });

    if (conflictingBooking) {
      throw new ConflictError('BOOKING_CONFLICT', 'This time slot is not available');
    }

    // Calculate amounts
    const baseAmount = parseFloat(pkg.price);
    const platformFee = Math.round(baseAmount * config.platform.feePercent) / 100;
    const totalAmount = baseAmount + platformFee;

    const bookingData = {
      chargerId,
      driverId,
      packageId,
      scheduledStart: start,
      scheduledEnd: end,
      baseAmount,
      platformFee,
      totalAmount,
      currency: pkg.currency,
      mandateId,
      bookedByAgent,
    };
    const bookingInclude = {
      charger: { select: { name: true, address: true } },
      package: { select: { name: true, durationMin: true } },
    };

    // Default path: hold the amount from the driver's PayPal-funded wallet. Booking, hold,
    // payment and session are written in one transaction, so a failed hold leaves nothing behind.
    if (fundingSource === 'wallet') {
      const walletBooking = await prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: { ...bookingData, status: 'authorized' },
          include: bookingInclude,
        });
        await walletService.hold(tx, driverId, totalAmount, created.id);
        await tx.payment.create({
          data: {
            bookingId: created.id,
            fundingSource: 'wallet',
            authorizedAmount: totalAmount,
            currency: created.currency,
            mandateId,
            status: 'authorized',
            authorizedAt: new Date(),
          },
        });
        await tx.session.create({ data: { bookingId: created.id, status: 'awaiting_start' } });
        return created;
      });

      return {
        booking: formatCreatedBooking(walletBooking, { baseAmount, platformFee, totalAmount }),
        payment: { fundingSource: 'wallet', status: 'authorized' },
        paypal: null,
      };
    }

    // Alternative path: authorize straight on PayPal, the buyer approves at PayPal
    const booking = await prisma.booking.create({
      data: { ...bookingData, status: 'pending' },
      include: bookingInclude,
    });

    // Create PayPal order
    const returnUrl = `${frontendUrl}/bookings/${booking.id}/confirm`;
    const cancelUrl = `${frontendUrl}/bookings/${booking.id}/cancel`;

    let paypalOrder;
    try {
      paypalOrder = await paypalService.createOrder({
        amount: totalAmount,
        currency: booking.currency,
        description: `EV Charging: ${charger.name} - ${pkg.name}`,
        bookingId: booking.id,
        mandateId,
        returnUrl,
        cancelUrl,
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          paypalOrderId: paypalOrder.orderId,
          authorizedAmount: totalAmount,
          currency: booking.currency,
          mandateId,
          fundingSource: 'paypal',
          status: 'pending',
        },
      });
    } catch (error) {
      // No order, no booking: close it so the time slot is free again
      await this.failBooking(booking.id, 'PayPal order could not be created').catch(() => {});
      throw error;
    }

    return {
      booking: formatCreatedBooking(booking, { baseAmount, platformFee, totalAmount }),
      payment: { fundingSource: 'paypal', status: 'pending' },
      paypal: {
        orderId: paypalOrder.orderId,
        approveUrl: paypalOrder.approveUrl,
      },
    };
  },

  /**
   * Complete booking after PayPal approval (authorize the payment)
   */
  async authorizeBooking(bookingId, userId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    if (booking.driverId !== userId) {
      throw new ForbiddenError('This is not your booking');
    }

    if (booking.status !== 'pending') {
      throw new ValidationError(`Booking is already ${booking.status}`);
    }

    // Authorize the PayPal order
    let authResult;
    try {
      authResult = await paypalService.authorizeOrder(booking.payment.paypalOrderId);
    } catch (error) {
      // Authorization failed or expired: close the booking so the slot is free again
      await this.failBooking(bookingId, 'PayPal authorization failed').catch(() => {});
      throw error;
    }

    // Update payment and booking
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          paypalAuthId: authResult.authorizationId,
          authorizedAmount: authResult.authorizedAmount,
          authorizedAt: new Date(),
          status: 'authorized',
        },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'authorized' },
      }),
      // Create session record
      prisma.session.create({
        data: {
          bookingId,
          status: 'awaiting_start',
        },
      }),
    ]);

    return {
      bookingId,
      status: 'authorized',
      authorizedAmount: authResult.authorizedAmount,
      message: 'Payment authorized. Funds are held until session completion.',
    };
  },

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId, userId, reason) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    if (booking.driverId !== userId) {
      throw new ForbiddenError('This is not your booking');
    }

    // Same call twice: answer again, move no money
    if (booking.status === 'cancelled') {
      return cancelledReply(booking);
    }

    if (!['pending', 'authorized'].includes(booking.status)) {
      throw new ValidationError(`Cannot cancel booking with status: ${booking.status}`);
    }

    // Calculate cancellation fee
    const { feePercent, feeAmount, refundAmount } = calculateCancellationFee(
      booking.scheduledStart,
      parseFloat(booking.totalAmount)
    );

    // Wallet-funded: the escrow is split in the ledger. The fee goes to the host (minus platform fee),
    // the rest returns to the driver. No PayPal call is needed.
    if (booking.payment?.fundingSource === 'wallet') {
      const total = parseFloat(booking.totalAmount);
      const hostId = (await prisma.charger.findUnique({
        where: { id: booking.chargerId },
        select: { hostId: true },
      })).hostId;

      const claimed = await prisma.$transaction(async (tx) => {
        // Claim the booking first. A second caller finds it already cancelled and moves nothing.
        const claim = await tx.booking.updateMany({
          where: { id: bookingId, status: { in: ['pending', 'authorized'] } },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationFee: feeAmount,
            cancellationReason: reason,
          },
        });
        if (claim.count === 0) return false;
        if (feeAmount > 0) {
          await walletService.release(tx, {
            driverId: booking.driverId,
            hostId,
            heldAmount: feeAmount,
            hostAmount: feeAmount * (1 - config.platform.feePercent / 100),
            bookingId,
          });
        }
        await walletService.returnHold(tx, booking.driverId, total - feeAmount, bookingId, 'Cancelled booking hold returned');
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            capturedAmount: feeAmount > 0 ? feeAmount : null,
            status: feeAmount > 0 ? 'captured' : 'voided',
          },
        });
        return true;
      });

      if (!claimed) {
        return cancelledReply({ ...booking, status: 'cancelled' });
      }

      return {
        bookingId,
        status: 'cancelled',
        cancellationFee: feeAmount,
        refundAmount,
        message: feePercent === 0
          ? 'Booking cancelled - hold returned to your wallet'
          : `Booking cancelled - ${feePercent}% cancellation fee applied, the rest returned to your wallet`,
      };
    }

    // Handle PayPal. Claim the booking first so a second call cannot void or capture twice.
    const claim = await prisma.booking.updateMany({
      where: { id: bookingId, status: { in: ['pending', 'authorized'] } },
      data: { status: 'cancelled' },
    });
    if (claim.count === 0) {
      return cancelledReply({ ...booking, status: 'cancelled' });
    }

    try {
    if (booking.status === 'authorized' && booking.payment?.paypalAuthId) {
      if (feeAmount > 0) {
        // Capture the cancellation fee
        await paypalService.captureAuthorization(
          booking.payment.paypalAuthId,
          feeAmount,
          booking.currency,
          true
        );
      } else {
        // Void the entire authorization
        await paypalService.voidAuthorization(booking.payment.paypalAuthId);
      }
    }
    } catch (error) {
      // PayPal refused: open the booking again so the cancel can be retried
      await prisma.booking.updateMany({ where: { id: bookingId, status: 'cancelled' }, data: { status: booking.status } });
      throw error;
    }

    // Update records
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationFee: feeAmount,
          cancellationReason: reason,
        },
      }),
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          capturedAmount: feeAmount > 0 ? feeAmount : null,
          status: feeAmount > 0 ? 'captured' : 'voided',
        },
      }),
    ]);

    return {
      bookingId,
      status: 'cancelled',
      cancellationFee: feeAmount,
      refundAmount,
      message: feePercent === 0 
        ? 'Booking cancelled - no fee applied'
        : `Booking cancelled - ${feePercent}% cancellation fee applied`,
    };
  },

  /**
   * Failure path (system call, no fee): give the whole hold back and close the booking.
   * Wallet holds return to the wallet; PayPal authorizations are voided. Safe to call twice.
   */
  async failBooking(bookingId, reason = 'Booking failed') {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) {
      throw new NotFoundError('Booking');
    }
    if (booking.status === 'cancelled') {
      return { bookingId, status: 'cancelled', alreadyCancelled: true, refundAmount: 0 };
    }
    if (!['pending', 'authorized'].includes(booking.status)) {
      throw new ValidationError(`Cannot fail booking with status: ${booking.status}`);
    }

    const total = parseFloat(booking.totalAmount);
    const closed = { status: 'cancelled', cancelledAt: new Date(), cancellationFee: 0, cancellationReason: reason };

    if (booking.payment?.fundingSource === 'wallet') {
      const done = await prisma.$transaction(async (tx) => {
        const claim = await tx.booking.updateMany({
          where: { id: bookingId, status: { in: ['pending', 'authorized'] } },
          data: closed,
        });
        if (claim.count === 0) return false;
        await walletService.returnHold(tx, booking.driverId, total, bookingId, 'Hold returned after booking failure');
        await tx.payment.update({ where: { id: booking.payment.id }, data: { status: 'voided' } });
        return true;
      });
      return { bookingId, status: 'cancelled', alreadyCancelled: !done, refundAmount: done ? total : 0 };
    }

    const claim = await prisma.booking.updateMany({
      where: { id: bookingId, status: { in: ['pending', 'authorized'] } },
      data: closed,
    });
    if (claim.count === 0) {
      return { bookingId, status: 'cancelled', alreadyCancelled: true, refundAmount: 0 };
    }
    try {
      if (booking.payment?.paypalAuthId) {
        await paypalService.voidAuthorization(booking.payment.paypalAuthId);
      }
    } catch (error) {
      await prisma.booking.updateMany({ where: { id: bookingId, status: 'cancelled' }, data: { status: booking.status } });
      throw error;
    }
    if (booking.payment) {
      await prisma.payment.update({ where: { id: booking.payment.id }, data: { status: 'voided' } });
    }
    return { bookingId, status: 'cancelled', alreadyCancelled: false, refundAmount: total };
  },

  /**
   * Submit a review for a booking.
   * - Driver of the booking (role 'driver') reviews the CHARGER  -> DriverRating
   * - Host of the charger  (role 'host')   reviews the DRIVER   -> HostRating
   * Only completed (or disputed) bookings can be reviewed, once per side.
   */
  async submitReview(bookingId, user, { rating, reviewText }) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: { select: { id: true, hostId: true } },
        driverRating: { select: { id: true } },
        hostRating: { select: { id: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    const reviewer = getReviewerSide(booking, user);
    if (reviewer.error) {
      throw new ForbiddenError(reviewer.error);
    }

    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      throw new ValidationError('You can only review a booking after the charging session is completed');
    }

    const text = reviewText?.trim() || null;

    if (reviewer.side === 'driver') {
      if (booking.driverRating) {
        throw new ConflictError('ALREADY_REVIEWED', 'You have already reviewed this booking');
      }
      const created = await prisma.$transaction(async (tx) => {
        const review = await tx.driverRating.create({
          data: {
            bookingId,
            chargerId: booking.charger.id,
            driverId: user.id,
            rating,
            reviewText: text,
          },
        });
        // Keep the stored charger average in sync with its reviews
        const { _avg } = await tx.driverRating.aggregate({
          where: { chargerId: booking.charger.id },
          _avg: { rating: true },
        });
        await tx.charger.update({
          where: { id: booking.charger.id },
          data: { avgRating: Math.round((_avg.rating || 0) * 10) / 10 },
        });
        return review;
      });
      return { review: formatReview(created), target: 'charger' };
    }

    if (booking.hostRating) {
      throw new ConflictError('ALREADY_REVIEWED', 'You have already reviewed this driver for this booking');
    }
    const created = await prisma.hostRating.create({
      data: {
        bookingId,
        driverId: booking.driverId,
        hostId: user.id,
        rating,
        reviewText: text,
      },
    });
    return { review: formatReview(created), target: 'driver' };
  },

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId, userId, userRoles = []) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: {
          include: {
            host: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        package: true,
        driver: {
          select: { id: true, name: true, phone: true },
        },
        session: true,
        payment: true,
        dispute: true,
        driverRating: true,
        hostRating: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check access
    const isDriver = booking.driverId === userId;
    const isHost = booking.charger.hostId === userId;

    if (!isDriver && !isHost) {
      throw new ForbiddenError('You do not have access to this booking');
    }

    // Review state for the viewer: which side they review from and whether they still can
    const reviewer = getReviewerSide(booking, { id: userId, roles: userRoles });
    const alreadyReviewed = reviewer.side === 'driver' ? !!booking.driverRating : !!booking.hostRating;
    const canReview = !reviewer.error
      && REVIEWABLE_STATUSES.includes(booking.status)
      && !alreadyReviewed;

    // Hosts see the driver's reputation from past host reviews
    let driverReputation;
    if (isHost) {
      const stats = await prisma.hostRating.aggregate({
        where: { driverId: booking.driverId },
        _avg: { rating: true },
        _count: true,
      });
      driverReputation = {
        avgRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
        totalReviews: stats._count,
      };
    }

    return {
      id: booking.id,
      status: booking.status,
      charger: {
        id: booking.charger.id,
        name: booking.charger.name,
        address: booking.charger.address,
        connectorType: booking.charger.connectorType,
        kwTier: booking.charger.kwTier,
        photos: booking.charger.photos || [],
        latitude: booking.charger.latitude,
        longitude: booking.charger.longitude,
        instructions: booking.charger.description,
        host: booking.charger.host,
      },
      driver: isHost ? { ...booking.driver, ...driverReputation } : undefined,
      reviews: {
        charger: formatReview(booking.driverRating), // driver -> charger
        driver: formatReview(booking.hostRating),    // host -> driver
      },
      canReview,
      reviewTarget: reviewer.side === 'driver' ? 'charger' : reviewer.side === 'host' ? 'driver' : null,
      package: {
        name: booking.package.name,
        durationMin: booking.package.durationMin,
      },
      startTime: booking.scheduledStart,
      endTime: booking.scheduledEnd,
      baseAmount: parseFloat(booking.baseAmount),
      platformFee: parseFloat(booking.platformFee),
      totalAmount: parseFloat(booking.totalAmount),
      currency: booking.currency,
      bookedByAgent: booking.bookedByAgent,
      session: booking.session ? {
        status: booking.session.status,
        actualStart: booking.session.actualStart,
        actualEnd: booking.session.actualEnd,
        actualDurationMin: booking.session.actualDurationMin,
      } : null,
      payment: {
        status: booking.payment?.status,
        authorizedAmount: booking.payment?.authorizedAmount ? parseFloat(booking.payment.authorizedAmount) : null,
        capturedAmount: booking.payment?.capturedAmount ? parseFloat(booking.payment.capturedAmount) : null,
      },
      hasDispute: !!booking.dispute,
      isDriver,
      isHost,
      createdAt: booking.createdAt,
    };
  },

  /**
   * Get user's bookings
   */
  async getUserBookings(userId, role, { status, page = 1, limit = 20 }) {
    const where = role === 'driver' 
      ? { driverId: userId }
      : { charger: { hostId: userId } };

    if (status) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          charger: {
            select: { 
              id: true, 
              name: true, 
              address: true,
              photos: true,
              connectorType: true,
              kwTier: true,
            },
          },
          package: {
            select: { name: true, durationMin: true },
          },
          driver: role === 'host' ? {
            select: { id: true, name: true },
          } : undefined,
          session: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        charger: b.charger,
        package: b.package,
        driver: b.driver,
        startTime: b.scheduledStart,
        endTime: b.scheduledEnd,
        totalAmount: parseFloat(b.totalAmount),
        currency: b.currency,
        sessionStatus: b.session?.status,
        createdAt: b.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },

  /**
   * Get bookings for host's chargers
   */
  async getHostBookings(hostId, { status, page = 1, limit = 20 }) {
    const where = {
      charger: {
        hostId,
      },
    };

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          charger: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          package: true,
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          session: {
            select: { status: true },
          },
        },
        orderBy: { scheduledStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        charger: {
          id: b.charger?.id,
          title: b.charger?.name,
          address: b.charger?.address,
        },
        package: b.package,
        user: b.driver,
        startTime: b.scheduledStart,
        endTime: b.scheduledEnd,
        duration: b.package?.durationMin ? b.package.durationMin / 60 : 1,
        totalAmount: parseFloat(b.totalAmount),
        currency: b.currency,
        sessionStatus: b.session?.status,
        createdAt: b.createdAt,
      })),
      pagination: { page, limit, total },
    };
  },
};

export default bookingService;
