import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { successResponse } from '../utils/apiResponse.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { config } from '../config/index.js';

const router = Router();

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  paypalEmail: z.string().email().optional(),
});

const addRoleSchema = z.object({
  role: z.enum(['driver', 'host']),
});

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/users/profile
 * Get current user's full profile
 */
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        roles: true,
        agents: {
          where: { status: 'active' },
        },
        _count: {
          select: {
            bookingsAsDriver: true,
            chargersOwned: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        paypalEmail: user.paypalEmail,
        roles: user.roles.map(r => r.role),
        totpEnabled: user.totpEnabled,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        stats: {
          bookings: user._count.bookingsAsDriver,
          chargers: user._count.chargersOwned,
          activeAgents: user.agents.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
router.put('/profile', authenticate, validateBody(updateProfileSchema), async (req, res, next) => {
  try {
    const { name, phone, avatarUrl, paypalEmail } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(paypalEmail !== undefined && { paypalEmail }),
      },
      include: {
        roles: true,
      },
    });

    successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        paypalEmail: user.paypalEmail,
        roles: user.roles.map(r => r.role),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users/roles
 * Add a role to current user (e.g., driver becomes host too)
 */
router.post('/roles', authenticate, validateBody(addRoleSchema), async (req, res, next) => {
  try {
    const { role } = req.body;

    // Check if already has role
    const existingRole = await prisma.userRoleMapping.findFirst({
      where: {
        userId: req.user.id,
        role,
      },
    });

    if (existingRole) {
      throw new ConflictError('USER_ROLE_EXISTS', `User already has the ${role} role`);
    }

    await prisma.userRoleMapping.create({
      data: {
        userId: req.user.id,
        role,
      },
    });

    // Get updated roles
    const roles = await prisma.userRoleMapping.findMany({
      where: { userId: req.user.id },
    });

    successResponse(res, {
      roles: roles.map(r => r.role),
      message: `${role} role added successfully`,
    }, 201);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/host/stats
 * Get host-specific stats for host dashboard
 */
router.get('/host/stats', authenticate, requireRole('host'), async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get host's chargers
    const chargers = await prisma.charger.findMany({
      where: { hostId: req.user.id },
      select: {
        id: true,
        status: true,
        avgRating: true,
      },
    });

    const chargerIds = chargers.map(c => c.id);

    // Total earnings (all time) - captured payments for host's chargers
    const totalEarnings = await prisma.payment.aggregate({
      where: {
        booking: { chargerId: { in: chargerIds } },
        status: 'captured',
      },
      _sum: { hostPayoutAmount: true },
    });

    // This month earnings
    const thisMonthEarnings = await prisma.payment.aggregate({
      where: {
        booking: { chargerId: { in: chargerIds } },
        status: 'captured',
        capturedAt: { gte: startOfMonth },
      },
      _sum: { hostPayoutAmount: true },
    });

    // Pending payout (authorized but not yet captured)
    const pendingPayout = await prisma.payment.aggregate({
      where: {
        booking: { chargerId: { in: chargerIds } },
        status: 'authorized',
      },
      _sum: { authorizedAmount: true },
    });

    // Total bookings count
    const totalBookings = await prisma.booking.count({
      where: { chargerId: { in: chargerIds } },
    });

    // Active chargers
    const activeChargers = chargers.filter(c => c.status === 'active').length;

    // Average rating across all chargers
    const ratings = chargers.filter(c => c.avgRating > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, c) => sum + parseFloat(c.avgRating), 0) / ratings.length
      : 0;

    successResponse(res, {
      totalEarnings: parseFloat(totalEarnings._sum.hostPayoutAmount || 0),
      thisMonthEarnings: parseFloat(thisMonthEarnings._sum.hostPayoutAmount || 0),
      pendingPayout: parseFloat(pendingPayout._sum.authorizedAmount || 0) * (1 - config.platform.feePercent / 100), // After platform fee
      totalBookings,
      activeChargers,
      totalChargers: chargers.length,
      averageRating: parseFloat(averageRating.toFixed(1)),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/dashboard
 * Get dashboard stats based on user's roles
 */
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const stats = {};
    const roles = req.user.roles;

    if (roles.includes('driver')) {
      // Driver stats
      const driverStats = await prisma.booking.groupBy({
        by: ['status'],
        where: { driverId: req.user.id },
        _count: true,
      });

      const totalSpent = await prisma.payment.aggregate({
        where: {
          booking: { driverId: req.user.id },
          status: 'captured',
        },
        _sum: { capturedAmount: true },
      });

      stats.driver = {
        bookingsByStatus: Object.fromEntries(
          driverStats.map(s => [s.status, s._count])
        ),
        totalSpent: totalSpent._sum.capturedAmount || 0,
      };
    }

    if (roles.includes('host')) {
      // Host stats
      const chargers = await prisma.charger.findMany({
        where: { hostId: req.user.id },
        select: {
          id: true,
          name: true,
          status: true,
          avgRating: true,
          totalBookings: true,
        },
      });

      const totalEarnings = await prisma.payment.aggregate({
        where: {
          booking: { charger: { hostId: req.user.id } },
          status: 'captured',
        },
        _sum: { hostPayoutAmount: true },
      });

      const pendingBookings = await prisma.booking.count({
        where: {
          charger: { hostId: req.user.id },
          status: { in: ['authorized', 'pending'] },
        },
      });

      stats.host = {
        chargers: chargers.length,
        chargerDetails: chargers,
        totalEarnings: totalEarnings._sum.hostPayoutAmount || 0,
        pendingBookings,
      };
    }

    successResponse(res, stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id/public
 * Get public profile of a user (for viewing hosts/drivers)
 */
router.get('/:id/public', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        roles: {
          select: { role: true },
        },
        _count: {
          select: {
            bookingsAsDriver: true,
            chargersOwned: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Calculate average rating if host
    let avgHostRating = null;
    if (user.roles.some(r => r.role === 'host')) {
      const ratings = await prisma.driverRating.aggregate({
        where: { charger: { hostId: user.id } },
        _avg: { rating: true },
        _count: true,
      });
      avgHostRating = {
        average: ratings._avg.rating || 0,
        count: ratings._count,
      };
    }

    // Calculate average driver rating
    let avgDriverRating = null;
    if (user.roles.some(r => r.role === 'driver')) {
      const ratings = await prisma.hostRating.aggregate({
        where: { driverId: user.id },
        _avg: { rating: true },
        _count: true,
      });
      avgDriverRating = {
        average: ratings._avg.rating || 0,
        count: ratings._count,
      };
    }

    successResponse(res, {
      user: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        memberSince: user.createdAt,
        roles: user.roles.map(r => r.role),
        stats: {
          totalBookings: user._count.bookingsAsDriver,
          chargersOwned: user._count.chargersOwned,
        },
        ratings: {
          asHost: avgHostRating,
          asDriver: avgDriverRating,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
