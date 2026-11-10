import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../utils/prisma.js';
import { disputeService } from '../services/dispute.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { successResponse, paginatedResponse } from '../utils/apiResponse.js';
import { createAuditLog, AuditActions } from '../services/audit.service.js';
import { config as appConfig } from '../config/index.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const resolveDisputeSchema = z.object({
  decision: z.enum(['release_to_host', 'partial_refund', 'full_refund']),
  refundAmount: z.number().min(0),
  adminNotes: z.string().max(1000).optional(),
});

const listQuerySchema = z.object({
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year', 'all']).optional().default('month'),
});

const userActionSchema = z.object({
  action: z.enum(['suspend', 'activate', 'verify', 'unverify']),
  reason: z.string().max(500).optional(),
});

const blockChargerSchema = z.object({
  reason: z.string().min(5, 'Block reason must be at least 5 characters').max(500),
});

const configUpdateSchema = z.object({
  key: z.string(),
  value: z.any(),
});

// ===========================================
// ROUTES
// ===========================================

// ===========================================
// DASHBOARD & ANALYTICS
// ===========================================

/**
 * GET /api/admin/dashboard
 * Get comprehensive dashboard data
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for performance
    const [
      // User stats
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      usersByRole,
      
      // Charger stats
      totalChargers,
      activeChargers,
      chargersByCity,
      
      // Booking stats
      totalBookings,
      bookingsThisMonth,
      bookingsLastMonth,
      bookingsByStatus,
      
      // Revenue stats
      revenueThisMonth,
      revenueLastMonth,
      totalRevenue,
      platformFeesTotal,
      
      // Disputes
      pendingDisputes,
      disputesThisMonth,
      
      // Ratings
      avgDriverRating,
      avgHostRating,
    ] = await Promise.all([
      // Users
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.userRoleMapping.groupBy({ by: ['role'], _count: true }),
      
      // Chargers
      prisma.charger.count(),
      prisma.charger.count({ where: { status: 'active' } }),
      prisma.charger.groupBy({ by: ['city'], _count: true, orderBy: { _count: { city: 'desc' } }, take: 10 }),
      
      // Bookings
      prisma.booking.count(),
      prisma.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.booking.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.booking.groupBy({ by: ['status'], _count: true }),
      
      // Revenue
      prisma.payment.aggregate({
        _sum: { capturedAmount: true, platformFeeAmount: true },
        where: { status: 'captured', capturedAt: { gte: startOfMonth } },
      }),
      prisma.payment.aggregate({
        _sum: { capturedAmount: true },
        where: { status: 'captured', capturedAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.payment.aggregate({
        _sum: { capturedAmount: true },
        where: { status: 'captured' },
      }),
      prisma.payment.aggregate({
        _sum: { platformFeeAmount: true },
        where: { status: 'captured' },
      }),
      
      // Disputes
      prisma.dispute.count({ where: { status: { in: ['open', 'ai_reviewed', 'pending_admin'] } } }),
      prisma.dispute.count({ where: { createdAt: { gte: startOfMonth } } }),
      
      // Ratings
      prisma.driverRating.aggregate({ _avg: { rating: true } }),
      prisma.hostRating.aggregate({ _avg: { rating: true } }),
    ]);

    // Calculate growth percentages
    const userGrowth = newUsersLastMonth > 0 
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(1)
      : 100;
    const bookingGrowth = bookingsLastMonth > 0
      ? ((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth * 100).toFixed(1)
      : 100;
    const revenueThisMonthVal = revenueThisMonth._sum.capturedAmount || 0;
    const revenueLastMonthVal = revenueLastMonth._sum.capturedAmount || 0;
    const revenueGrowth = revenueLastMonthVal > 0
      ? ((revenueThisMonthVal - revenueLastMonthVal) / revenueLastMonthVal * 100).toFixed(1)
      : 100;

    successResponse(res, {
      overview: {
        totalUsers,
        totalChargers,
        totalBookings,
        totalRevenue: parseFloat(totalRevenue._sum.capturedAmount || 0),
        platformEarnings: parseFloat(platformFeesTotal._sum.platformFeeAmount || 0),
        pendingDisputes,
      },
      growth: {
        users: {
          thisMonth: newUsersThisMonth,
          lastMonth: newUsersLastMonth,
          percentChange: parseFloat(userGrowth),
        },
        bookings: {
          thisMonth: bookingsThisMonth,
          lastMonth: bookingsLastMonth,
          percentChange: parseFloat(bookingGrowth),
        },
        revenue: {
          thisMonth: parseFloat(revenueThisMonthVal),
          lastMonth: parseFloat(revenueLastMonthVal),
          percentChange: parseFloat(revenueGrowth),
        },
      },
      usersByRole: Object.fromEntries(usersByRole.map(r => [r.role, r._count])),
      bookingsByStatus: Object.fromEntries(bookingsByStatus.map(b => [b.status, b._count])),
      topCities: chargersByCity.map(c => ({ city: c.city, count: c._count })),
      chargerStats: {
        total: totalChargers,
        active: activeChargers,
        inactive: totalChargers - activeChargers,
      },
      disputeStats: {
        pending: pendingDisputes,
        thisMonth: disputesThisMonth,
      },
      ratings: {
        avgDriverRating: avgDriverRating._avg.rating ? parseFloat(avgDriverRating._avg.rating.toFixed(1)) : null,
        avgHostRating: avgHostRating._avg.rating ? parseFloat(avgHostRating._avg.rating.toFixed(1)) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Get detailed revenue analytics
 */
router.get('/analytics/revenue', validateQuery(dateRangeSchema), async (req, res, next) => {
  try {
    const { period } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 30)); // Last 30 days
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 12 * 7)); // Last 12 weeks
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 12)); // Last 12 months
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 5)); // Last 5 years
        break;
      default:
        startDate = new Date('2020-01-01');
    }

    const payments = await prisma.payment.findMany({
      where: {
        status: 'captured',
        capturedAt: { gte: startDate },
      },
      select: {
        capturedAmount: true,
        platformFeeAmount: true,
        hostPayoutAmount: true,
        capturedAt: true,
      },
      orderBy: { capturedAt: 'asc' },
    });

    // Aggregate by period
    const aggregated = {};
    payments.forEach(p => {
      const date = p.capturedAt;
      let key;
      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = `${date.getFullYear()}`;
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!aggregated[key]) {
        aggregated[key] = { period: key, revenue: 0, platformFees: 0, hostPayouts: 0, transactions: 0 };
      }
      aggregated[key].revenue += parseFloat(p.capturedAmount || 0);
      aggregated[key].platformFees += parseFloat(p.platformFeeAmount || 0);
      aggregated[key].hostPayouts += parseFloat(p.hostPayoutAmount || 0);
      aggregated[key].transactions += 1;
    });

    const timeline = Object.values(aggregated).map(a => ({
      ...a,
      revenue: parseFloat(a.revenue.toFixed(2)),
      platformFees: parseFloat(a.platformFees.toFixed(2)),
      hostPayouts: parseFloat(a.hostPayouts.toFixed(2)),
    }));

    // Top earners (hosts)
    const topHosts = await prisma.payment.groupBy({
      by: ['bookingId'],
      _sum: { hostPayoutAmount: true },
      where: { status: 'captured' },
    });

    // Get booking details for top hosts
    const bookingIds = topHosts.map(t => t.bookingId);
    const bookings = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      include: {
        charger: {
          include: { host: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    // Aggregate by host
    const hostEarnings = {};
    bookings.forEach(b => {
      const hostId = b.charger.host.id;
      const payment = topHosts.find(t => t.bookingId === b.id);
      if (!hostEarnings[hostId]) {
        hostEarnings[hostId] = {
          host: { id: b.charger.host.id, name: b.charger.host.name },
          totalEarnings: 0,
          bookings: 0,
        };
      }
      hostEarnings[hostId].totalEarnings += parseFloat(payment?._sum.hostPayoutAmount || 0);
      hostEarnings[hostId].bookings += 1;
    });

    const topHostsList = Object.values(hostEarnings)
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, 10)
      .map(h => ({
        ...h,
        totalEarnings: parseFloat(h.totalEarnings.toFixed(2)),
      }));

    successResponse(res, {
      timeline,
      topHosts: topHostsList,
      summary: {
        totalRevenue: timeline.reduce((sum, t) => sum + t.revenue, 0),
        totalPlatformFees: timeline.reduce((sum, t) => sum + t.platformFees, 0),
        totalTransactions: timeline.reduce((sum, t) => sum + t.transactions, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/geographic
 * Get geographic distribution analytics
 */
router.get('/analytics/geographic', async (req, res, next) => {
  try {
    // Chargers by city
    const chargersByCity = await prisma.charger.groupBy({
      by: ['city'],
      _count: true,
      _avg: { avgRating: true },
    });

    // Bookings by city (through charger)
    const bookingsWithCity = await prisma.booking.findMany({
      select: {
        charger: { select: { city: true, latitude: true, longitude: true } },
        totalAmount: true,
      },
    });

    const cityBookings = {};
    bookingsWithCity.forEach(b => {
      const city = b.charger.city;
      if (!cityBookings[city]) {
        cityBookings[city] = {
          city,
          bookings: 0,
          revenue: 0,
          lat: parseFloat(b.charger.latitude),
          lng: parseFloat(b.charger.longitude),
        };
      }
      cityBookings[city].bookings += 1;
      cityBookings[city].revenue += parseFloat(b.totalAmount);
    });

    // Most active areas (by booking density)
    const hotspots = await prisma.charger.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        totalBookings: true,
        avgRating: true,
      },
      orderBy: { totalBookings: 'desc' },
      take: 20,
    });

    successResponse(res, {
      byCity: chargersByCity.map(c => ({
        city: c.city,
        chargers: c._count,
        avgRating: c._avg.avgRating ? parseFloat(c._avg.avgRating.toFixed(1)) : null,
        bookings: cityBookings[c.city]?.bookings || 0,
        revenue: cityBookings[c.city]?.revenue ? parseFloat(cityBookings[c.city].revenue.toFixed(2)) : 0,
      })),
      hotspots: hotspots.map(h => ({
        id: h.id,
        name: h.name,
        address: h.address,
        city: h.city,
        location: { lat: parseFloat(h.latitude), lng: parseFloat(h.longitude) },
        bookings: h.totalBookings,
        rating: h.avgRating ? parseFloat(h.avgRating) : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/usage
 * Get platform usage analytics
 */
router.get('/analytics/usage', async (req, res, next) => {
  try {
    // Bookings by hour of day
    const bookings = await prisma.booking.findMany({
      select: { scheduledStart: true, bookedByAgent: true },
    });

    const byHour = Array(24).fill(0);
    const byDayOfWeek = Array(7).fill(0);
    let agentBookings = 0;
    let manualBookings = 0;

    bookings.forEach(b => {
      byHour[b.scheduledStart.getHours()] += 1;
      byDayOfWeek[b.scheduledStart.getDay()] += 1;
      if (b.bookedByAgent) agentBookings++;
      else manualBookings++;
    });

    // Popular connector types
    const byConnectorType = await prisma.charger.groupBy({
      by: ['connectorType'],
      _count: true,
    });

    // Popular kW tiers
    const byKwTier = await prisma.charger.groupBy({
      by: ['kwTier'],
      _count: true,
    });

    // Average session duration
    const sessions = await prisma.session.aggregate({
      _avg: { actualDurationMin: true },
      where: { status: 'ended' },
    });

    successResponse(res, {
      bookingsByHour: byHour.map((count, hour) => ({ hour, count })),
      bookingsByDayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => ({
        day,
        count: byDayOfWeek[i],
      })),
      bookingSource: {
        agent: agentBookings,
        manual: manualBookings,
        agentPercentage: bookings.length > 0 
          ? parseFloat((agentBookings / bookings.length * 100).toFixed(1)) 
          : 0,
      },
      connectorTypes: byConnectorType.map(c => ({ type: c.connectorType, count: c._count })),
      kwTiers: byKwTier.map(k => ({ tier: k.kwTier, count: k._count })),
      avgSessionDuration: sessions._avg.actualDurationMin 
        ? parseFloat(sessions._avg.actualDurationMin.toFixed(0)) 
        : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/disputes
 * Get disputes pending admin review
 */
router.get('/disputes', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where: {
          status: { in: ['pending_admin', 'ai_reviewed'] },
        },
        include: {
          booking: {
            include: {
              charger: { select: { name: true } },
              driver: { select: { name: true } },
            },
          },
          raisedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dispute.count({
        where: { status: { in: ['pending_admin', 'ai_reviewed'] } },
      }),
    ]);

    paginatedResponse(res, disputes.map(d => ({
      id: d.id,
      bookingId: d.bookingId,
      chargerName: d.booking.charger.name,
      driverName: d.booking.driver.name,
      raisedBy: d.raisedBy.name,
      reason: d.reason,
      status: d.status,
      aiRecommendation: d.aiDecision ? {
        decision: d.aiDecision,
        refundAmount: d.aiRefundAmount ? parseFloat(d.aiRefundAmount) : null,
        confidence: d.aiConfidence ? parseFloat(d.aiConfidence) : null,
      } : null,
      createdAt: d.createdAt,
    })), { page, limit, total });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/disputes/:id
 * Get full dispute details for admin review
 */
router.get('/disputes/:id', async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        booking: {
          include: {
            charger: true,
            package: true,
            driver: { select: { id: true, name: true, email: true } },
            session: true,
            payment: true,
            auditLogs: true,
          },
        },
        raisedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Dispute not found' },
      });
    }

    successResponse(res, {
      dispute: {
        id: dispute.id,
        status: dispute.status,
        reason: dispute.reason,
        description: dispute.description,
        evidence: dispute.evidence,
        raisedBy: dispute.raisedBy,
        raisedByRole: dispute.raisedByRole,
        booking: {
          id: dispute.booking.id,
          charger: {
            name: dispute.booking.charger.name,
            address: dispute.booking.charger.address,
          },
          package: {
            name: dispute.booking.package.name,
            durationMin: dispute.booking.package.durationMin,
          },
          driver: dispute.booking.driver,
          scheduledStart: dispute.booking.scheduledStart,
          scheduledEnd: dispute.booking.scheduledEnd,
          totalAmount: parseFloat(dispute.booking.totalAmount),
        },
        session: dispute.booking.session,
        payment: {
          capturedAmount: dispute.booking.payment?.capturedAmount 
            ? parseFloat(dispute.booking.payment.capturedAmount) 
            : null,
          status: dispute.booking.payment?.status,
        },
        auditLogs: dispute.booking.auditLogs,
        aiAnalysis: dispute.aiDecision ? {
          decision: dispute.aiDecision,
          refundAmount: dispute.aiRefundAmount ? parseFloat(dispute.aiRefundAmount) : null,
          reasoning: dispute.aiReasoning,
          confidence: dispute.aiConfidence ? parseFloat(dispute.aiConfidence) : null,
          reviewedAt: dispute.aiReviewedAt,
        } : null,
        createdAt: dispute.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/disputes/:id/resolve
 * Resolve a dispute
 */
router.post('/disputes/:id/resolve', validateBody(resolveDisputeSchema), async (req, res, next) => {
  try {
    const result = await disputeService.resolveDispute(
      req.params.id,
      req.user.id,
      {
        decision: req.body.decision,
        refundAmount: req.body.refundAmount,
        adminNotes: req.body.adminNotes,
      }
    );

    // Audit log for dispute resolution
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.DISPUTE_RESOLVE,
      resource: 'dispute',
      resourceId: req.params.id,
      details: {
        decision: req.body.decision,
        refundAmount: req.body.refundAmount,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users
 * List users
 */
router.get('/users', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: {
          roles: true,
          _count: {
            select: {
              bookingsAsDriver: true,
              chargersOwned: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    paginatedResponse(res, users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      roles: u.roles.map(r => r.role),
      bookings: u._count.bookingsAsDriver,
      chargers: u._count.chargersOwned,
      createdAt: u.createdAt,
    })), { page, limit, total });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/bookings
 * List all bookings
 */
router.get('/bookings', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { status } = req.query;

    const where = status ? { status } : {};

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          charger: { select: { name: true } },
          driver: { select: { name: true } },
          payment: { select: { status: true, capturedAmount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    paginatedResponse(res, bookings.map(b => ({
      id: b.id,
      chargerName: b.charger.name,
      driverName: b.driver.name,
      scheduledStart: b.scheduledStart,
      totalAmount: parseFloat(b.totalAmount),
      status: b.status,
      paymentStatus: b.payment?.status,
      createdAt: b.createdAt,
    })), { page, limit, total });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// USER MANAGEMENT
// ===========================================

/**
 * GET /api/admin/users/:id
 * Get detailed user information
 */
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        roles: true,
        bookingsAsDriver: {
          include: {
            charger: { select: { name: true } },
            payment: { select: { status: true, capturedAmount: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        chargersOwned: {
          select: {
            id: true,
            name: true,
            status: true,
            totalBookings: true,
            avgRating: true,
          },
        },
        disputesRaised: {
          select: { id: true, status: true, reason: true, createdAt: true },
        },
        // Reviews hosts left about this user as a driver
        hostRatingsReceived: {
          select: { rating: true, reviewText: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            bookingsAsDriver: true,
            chargersOwned: true,
            disputesRaised: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Calculate user stats
    const totalSpent = await prisma.payment.aggregate({
      _sum: { capturedAmount: true },
      where: {
        booking: { driverId: user.id },
        status: 'captured',
      },
    });

    const totalEarned = await prisma.payment.aggregate({
      _sum: { hostPayoutAmount: true },
      where: {
        booking: { charger: { hostId: user.id } },
        status: 'captured',
      },
    });

    // Mask sensitive data for privacy compliance
    successResponse(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ? `${user.phone.slice(0, 4)}****${user.phone.slice(-2)}` : null, // Masked for privacy
      roles: user.roles.map(r => r.role),
      isVerified: user.isVerified,
      totpEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      stats: {
        totalBookings: user._count.bookingsAsDriver,
        totalChargers: user._count.chargersOwned,
        totalDisputes: user._count.disputesRaised,
        totalSpent: parseFloat(totalSpent._sum.capturedAmount || 0),
        totalEarned: parseFloat(totalEarned._sum.hostPayoutAmount || 0),
      },
      recentBookings: user.bookingsAsDriver.map(b => ({
        id: b.id,
        charger: b.charger.name,
        amount: parseFloat(b.totalAmount),
        status: b.status,
        paymentStatus: b.payment?.status,
        date: b.scheduledStart,
      })),
      chargers: user.chargersOwned.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        bookings: c.totalBookings,
        rating: c.avgRating ? parseFloat(c.avgRating) : null,
      })),
      disputes: user.disputesRaised,
      recentRatingsReceived: user.hostRatingsReceived.map(r => ({
        rating: r.rating,
        review: r.reviewText,
        date: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users/:id/action
 * Perform administrative action on user (suspend, verify, etc.)
 * Note: All actions are logged for audit trail
 */
router.post('/users/:id/action', validateBody(userActionSchema), async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    const userId = req.params.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    let updateData = {};
    let auditAction = '';

    switch (action) {
      case 'verify':
        updateData = { isVerified: true };
        auditAction = AuditActions.ADMIN_USER_ACTION;
        break;
      case 'unverify':
        updateData = { isVerified: false };
        auditAction = AuditActions.ADMIN_USER_ACTION;
        break;
      // Note: Suspend/activate would require a 'suspended' field in schema
      // For now, we'll use verify/unverify as the available actions
      default:
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Invalid action' },
        });
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Create audit log for accountability
    await createAuditLog({
      userId: req.user.id,
      action: auditAction,
      resource: 'user',
      resourceId: userId,
      details: { action, reason, targetUser: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, { message: `User ${action} successful` });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CHARGER MANAGEMENT
// ===========================================

/**
 * GET /api/admin/chargers
 * List all chargers with detailed stats
 */
router.get('/chargers', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { status, city } = req.query;

    const where = {};
    if (status) where.status = status;
    if (city) where.city = city;

    const [chargers, total] = await Promise.all([
      prisma.charger.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, email: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.charger.count({ where }),
    ]);

    paginatedResponse(res, chargers.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      city: c.city,
      host: { id: c.host.id, name: c.host.name },
      connectorType: c.connectorType,
      kwTier: c.kwTier,
      status: c.status,
      isBlocked: c.isBlocked,
      blockReason: c.blockReason,
      bookings: c._count.bookings,
      rating: c.avgRating ? parseFloat(c.avgRating) : null,
      createdAt: c.createdAt,
    })), { page, limit, total });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/chargers/:id/status
 * Update charger status (for moderation)
 */
router.patch('/chargers/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Invalid status' },
      });
    }

    const charger = await prisma.charger.update({
      where: { id: req.params.id },
      data: { status },
    });

    // Audit log using centralized service
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.CHARGER_UPDATE,
      resource: 'charger',
      resourceId: req.params.id,
      details: { newStatus: status, adminAction: true },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, { id: charger.id, status: charger.status });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/chargers/:id
 * Get detailed charger information for admin
 */
router.get('/chargers/:id', async (req, res, next) => {
  try {
    const charger = await prisma.charger.findUnique({
      where: { id: req.params.id },
      include: {
        host: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        packages: true,
        availability: true,
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            driver: { select: { name: true, email: true } },
            payment: { select: { status: true, capturedAmount: true } },
          },
        },
        driverRatings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            driver: { select: { name: true } },
          },
        },
        blockedByUser: { select: { name: true, email: true } },
        _count: {
          select: { bookings: true, driverRatings: true },
        },
      },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    // Calculate revenue from this charger
    const revenue = await prisma.payment.aggregate({
      _sum: { capturedAmount: true, platformFeeAmount: true, hostPayoutAmount: true },
      where: {
        booking: { chargerId: charger.id },
        status: 'captured',
      },
    });

    successResponse(res, {
      charger: {
        id: charger.id,
        name: charger.name,
        description: charger.description,
        address: charger.address,
        city: charger.city,
        location: {
          lat: parseFloat(charger.latitude),
          lng: parseFloat(charger.longitude),
        },
        connectorType: charger.connectorType,
        kwTier: charger.kwTier,
        amenities: charger.amenities,
        photos: charger.photos,
        status: charger.status,
        
        // Blocking info
        isBlocked: charger.isBlocked,
        blockedAt: charger.blockedAt,
        blockReason: charger.blockReason,
        blockedBy: charger.blockedByUser,
        
        // Stats
        totalBookings: charger.totalBookings,
        avgRating: charger.avgRating ? parseFloat(charger.avgRating) : null,
        totalRatings: charger._count.driverRatings,
        
        // Revenue
        revenue: {
          total: parseFloat(revenue._sum.capturedAmount || 0),
          platformFees: parseFloat(revenue._sum.platformFeeAmount || 0),
          hostPayouts: parseFloat(revenue._sum.hostPayoutAmount || 0),
        },
        
        // Related data
        host: charger.host,
        packages: charger.packages.map(p => ({
          id: p.id,
          name: p.name,
          durationMin: p.durationMin,
          price: parseFloat(p.price),
          currency: p.currency,
          isActive: p.isActive,
        })),
        availability: charger.availability,
        recentBookings: charger.bookings.map(b => ({
          id: b.id,
          driver: b.driver.name,
          scheduledStart: b.scheduledStart,
          status: b.status,
          paymentStatus: b.payment?.status,
          amount: b.payment?.capturedAmount ? parseFloat(b.payment.capturedAmount) : null,
        })),
        recentRatings: charger.driverRatings.map(r => ({
          rating: r.rating,
          review: r.reviewText,
          driver: r.driver.name,
          createdAt: r.createdAt,
        })),
        
        createdAt: charger.createdAt,
        updatedAt: charger.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/chargers/:id/block
 * Block a charger (hides it from the site)
 */
router.post('/chargers/:id/block', validateBody(blockChargerSchema), async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const charger = await prisma.charger.findUnique({
      where: { id: req.params.id },
      include: { host: { select: { name: true, email: true } } },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (charger.isBlocked) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_BLOCKED', message: 'Charger is already blocked' },
      });
    }

    // Block the charger
    const updatedCharger = await prisma.charger.update({
      where: { id: req.params.id },
      data: {
        isBlocked: true,
        blockedAt: new Date(),
        blockedBy: req.user.id,
        blockReason: reason,
        status: 'blocked',
      },
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CHARGER_BLOCKED',
      resource: 'charger',
      resourceId: req.params.id,
      details: {
        chargerName: charger.name,
        hostName: charger.host.name,
        hostEmail: charger.host.email,
        reason,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, {
      message: 'Charger blocked successfully',
      charger: {
        id: updatedCharger.id,
        name: updatedCharger.name,
        isBlocked: updatedCharger.isBlocked,
        blockedAt: updatedCharger.blockedAt,
        blockReason: updatedCharger.blockReason,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/chargers/:id/unblock
 * Unblock a charger (makes it visible again)
 */
router.post('/chargers/:id/unblock', async (req, res, next) => {
  try {
    const charger = await prisma.charger.findUnique({
      where: { id: req.params.id },
      include: { host: { select: { name: true, email: true } } },
    });

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    if (!charger.isBlocked) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_BLOCKED', message: 'Charger is not blocked' },
      });
    }

    // Unblock the charger
    const updatedCharger = await prisma.charger.update({
      where: { id: req.params.id },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedBy: null,
        blockReason: null,
        status: 'active',
      },
    });

    // Audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'CHARGER_UNBLOCKED',
      resource: 'charger',
      resourceId: req.params.id,
      details: {
        chargerName: charger.name,
        hostName: charger.host.name,
        previousBlockReason: charger.blockReason,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, {
      message: 'Charger unblocked successfully',
      charger: {
        id: updatedCharger.id,
        name: updatedCharger.name,
        isBlocked: updatedCharger.isBlocked,
        status: updatedCharger.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// RATINGS & FEEDBACK
// ===========================================

/**
 * GET /api/admin/ratings
 * Get all ratings and reviews for moderation
 */
router.get('/ratings', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { type } = req.query; // 'driver' or 'host'

    let ratings = [];
    let total = 0;

    if (!type || type === 'driver') {
      const [driverRatings, driverTotal] = await Promise.all([
        prisma.driverRating.findMany({
          include: {
            driver: { select: { name: true } },
            charger: { select: { name: true, host: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.driverRating.count(),
      ]);

      ratings = driverRatings.map(r => ({
        id: r.id,
        type: 'driver',
        rating: r.rating,
        review: r.reviewText,
        reviewer: r.driver.name,
        subject: r.charger.name,
        subjectOwner: r.charger.host.name,
        createdAt: r.createdAt,
      }));
      total = driverTotal;
    }

    if (type === 'host') {
      const [hostRatings, hostTotal] = await Promise.all([
        prisma.hostRating.findMany({
          include: {
            host: { select: { name: true } },
            driver: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.hostRating.count(),
      ]);

      ratings = hostRatings.map(r => ({
        id: r.id,
        type: 'host',
        rating: r.rating,
        review: r.reviewText,
        reviewer: r.host.name,
        subject: r.driver.name,
        createdAt: r.createdAt,
      }));
      total = hostTotal;
    }

    paginatedResponse(res, ratings, { page, limit, total });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// AUDIT LOGS (Legal Compliance)
// ===========================================

/**
 * GET /api/admin/audit-logs
 * Get audit trail for compliance and accountability
 */
router.get('/audit-logs', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { action, userId, startDate, endDate } = req.query;

    const where = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          agent: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    paginatedResponse(res, logs.map(l => ({
      id: l.id,
      action: l.action,
      user: l.user ? { name: l.user.name } : null,
      agent: l.agent ? { name: l.agent.name } : null,
      success: l.success,
      errorMessage: l.errorMessage,
      durationMs: l.durationMs,
      createdAt: l.createdAt,
      // Note: inputs/outputs may contain sensitive data, only show in detail view
    })), { page, limit, total });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/audit-logs/:id
 * Get detailed audit log entry
 */
router.get('/audit-logs/:id', async (req, res, next) => {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        booking: { select: { id: true, status: true } },
        mandate: { select: { id: true, status: true } },
      },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Audit log not found' },
      });
    }

    successResponse(res, {
      ...log,
      // Redact sensitive information from inputs/outputs
      inputs: log.inputs ? redactSensitiveData(log.inputs) : null,
      outputs: log.outputs ? redactSensitiveData(log.outputs) : null,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PAYMENTS & INVOICES
// ===========================================

/**
 * GET /api/admin/payments
 * List all payments
 */
router.get('/payments', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const { status } = req.query;

    const where = status ? { status } : {};

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: {
            include: {
              driver: { select: { name: true } },
              charger: { select: { name: true, host: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    paginatedResponse(res, payments.map(p => ({
      id: p.id,
      bookingId: p.bookingId,
      driver: p.booking.driver.name,
      host: p.booking.charger.host.name,
      charger: p.booking.charger.name,
      authorizedAmount: p.authorizedAmount ? parseFloat(p.authorizedAmount) : null,
      capturedAmount: p.capturedAmount ? parseFloat(p.capturedAmount) : null,
      platformFee: p.platformFeeAmount ? parseFloat(p.platformFeeAmount) : null,
      hostPayout: p.hostPayoutAmount ? parseFloat(p.hostPayoutAmount) : null,
      refundedAmount: parseFloat(p.refundedAmount || 0),
      status: p.status,
      paypalOrderId: p.paypalOrderId,
      createdAt: p.createdAt,
      capturedAt: p.capturedAt,
    })), { page, limit, total });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/payments/summary
 * Get payment summary for accounting
 */
router.get('/payments/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = { status: 'captured' };
    if (startDate || endDate) {
      where.capturedAt = {};
      if (startDate) where.capturedAt.gte = new Date(startDate);
      if (endDate) where.capturedAt.lte = new Date(endDate);
    }

    const summary = await prisma.payment.aggregate({
      where,
      _sum: {
        capturedAmount: true,
        platformFeeAmount: true,
        hostPayoutAmount: true,
        refundedAmount: true,
      },
      _count: true,
    });

    // Get refunds separately
    const refunds = await prisma.payment.aggregate({
      where: {
        status: { in: ['refunded', 'partially_refunded'] },
        ...(startDate || endDate ? {
          refundedAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) }),
          },
        } : {}),
      },
      _sum: { refundedAmount: true },
      _count: true,
    });

    successResponse(res, {
      period: {
        startDate: startDate || 'all time',
        endDate: endDate || 'present',
      },
      transactions: summary._count,
      grossRevenue: parseFloat(summary._sum.capturedAmount || 0),
      platformFees: parseFloat(summary._sum.platformFeeAmount || 0),
      hostPayouts: parseFloat(summary._sum.hostPayoutAmount || 0),
      refunds: {
        count: refunds._count,
        amount: parseFloat(refunds._sum.refundedAmount || 0),
      },
      netPlatformRevenue: parseFloat(
        (summary._sum.platformFeeAmount || 0) - (refunds._sum.refundedAmount || 0) * (appConfig.platform.feePercent / 100) // Approximate platform fee on refunds
      ),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PLATFORM CONFIGURATION
// ===========================================

// In-memory config (in production, use database or environment variables)
const platformConfig = {
  platformFeePercent: appConfig.platform.feePercent,
  aiConfidenceThreshold: 95,
  maxBookingAdvanceDays: 30,
  cancellationFeePercent: 10,
  minWithdrawalAmount: 100,
  supportEmail: 'support@evcharge.com',
  termsVersion: '1.0',
  privacyPolicyVersion: '1.0',
};

/**
 * GET /api/admin/config
 * Get platform configuration
 */
router.get('/config', (req, res) => {
  successResponse(res, platformConfig);
});

/**
 * PATCH /api/admin/config
 * Update platform configuration
 * Note: Changes are logged for audit trail
 */
router.patch('/config', validateBody(configUpdateSchema), async (req, res, next) => {
  try {
    const { key, value } = req.body;
    
    if (!(key in platformConfig)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CONFIG_KEY', message: 'Invalid configuration key' },
      });
    }

    const oldValue = platformConfig[key];
    platformConfig[key] = value;

    // Audit log for config changes using centralized service
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.ADMIN_CONFIG_UPDATE,
      resource: 'config',
      resourceId: key,
      details: { key, oldValue, newValue: value },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    successResponse(res, { key, value, message: 'Configuration updated' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// EXPORT DATA (Legal Compliance - GDPR/DPDP)
// ===========================================

/**
 * GET /api/admin/users/:id/export
 * Export user data for GDPR/DPDP compliance
 * This allows users to request their data (right to access)
 */
router.get('/users/:id/export', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        roles: true,
        bookingsAsDriver: {
          include: {
            charger: { select: { name: true, address: true } },
            payment: true,
          },
        },
        chargersOwned: true,
        driverRatings: true,
        disputesRaised: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    // Audit this data export using centralized service
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.ADMIN_DATA_EXPORT,
      resource: 'user',
      resourceId: req.params.id,
      details: { targetUser: user.email, exportType: 'GDPR_DPDP' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Return sanitized user data
    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: 'Admin',
      userData: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        roles: user.roles.map(r => r.role),
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      bookings: user.bookingsAsDriver.map(b => ({
        id: b.id,
        charger: b.charger.name,
        location: b.charger.address,
        scheduledStart: b.scheduledStart,
        scheduledEnd: b.scheduledEnd,
        amount: parseFloat(b.totalAmount),
        status: b.status,
        createdAt: b.createdAt,
      })),
      chargers: user.chargersOwned.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        status: c.status,
        createdAt: c.createdAt,
      })),
      ratingsGiven: user.driverRatings.map(r => ({
        rating: r.rating,
        review: r.reviewText,
        createdAt: r.createdAt,
      })),
      disputes: user.disputesRaised.map(d => ({
        id: d.id,
        reason: d.reason,
        status: d.status,
        createdAt: d.createdAt,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    next(error);
  }
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Redact sensitive data from objects for security
 */
function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'totpSecret', 'apiKey'];
  const redacted = { ...obj };
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  
  return redacted;
}

export default router;
