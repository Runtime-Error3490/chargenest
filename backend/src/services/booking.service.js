import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { paypalService } from './paypal.service.js';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError,
  ForbiddenError 
} from '../utils/errors.js';

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

export const bookingService = {
  /**
   * Create a new booking with PayPal authorization
   */
  async createBooking({
    driverId,
    chargerId,
    packageId,
    scheduledStart,
    mandateId = null,
    bookedByAgent = false,
    frontendUrl,
  }) {
    // Get charger and package
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: {
        packages: { where: { id: packageId } },
        host: { select: { paypalEmail: true } },
      },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    if (charger.status !== 'active') {
      throw new ValidationError('Charger is not available');
    }

    const pkg = charger.packages[0];
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

    // Create booking
    const booking = await prisma.booking.create({
      data: {
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
        status: 'pending',
      },
      include: {
        charger: {
          select: { name: true, address: true },
        },
        package: {
          select: { name: true, durationMin: true },
        },
      },
    });

    // Create PayPal order
    const returnUrl = `${frontendUrl}/bookings/${booking.id}/confirm`;
    const cancelUrl = `${frontendUrl}/bookings/${booking.id}/cancel`;

    const paypalOrder = await paypalService.createOrder({
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
        status: 'pending',
      },
    });

    return {
      booking: {
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
      },
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
    const authResult = await paypalService.authorizeOrder(booking.payment.paypalOrderId);

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

    if (!['pending', 'authorized'].includes(booking.status)) {
      throw new ValidationError(`Cannot cancel booking with status: ${booking.status}`);
    }

    // Calculate cancellation fee
    const { feePercent, feeAmount, refundAmount } = calculateCancellationFee(
      booking.scheduledStart,
      parseFloat(booking.totalAmount)
    );

    // Handle PayPal
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
   * Get booking by ID
   */
  async getBookingById(bookingId, userId) {
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
      driver: isHost ? booking.driver : undefined,
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
