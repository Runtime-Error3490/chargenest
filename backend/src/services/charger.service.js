import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { walletService } from './wallet.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate suggested price based on kW tier
 */
function calculateSuggestedPrice(kwTier, city = 'Bengaluru') {
  // Base electricity cost estimate (INR per kWh)
  const electricityCost = 8; // Average in Bengaluru
  
  // kW values for each tier
  const kwValues = {
    'kW3_3': 3.3,
    'kW7_4': 7.4,
    'kW11': 11,
    'kW22': 22,
    'kW50': 50,
    'kW150': 150,
  };

  const kw = kwValues[kwTier] || 7.4;
  
  // Cost per hour = kW * electricity cost per kWh
  const costPerHour = kw * electricityCost;
  
  // Add margin (50-100% depending on tier)
  const marginMultiplier = kw <= 11 ? 1.5 : (kw <= 22 ? 1.8 : 2.0);
  
  return Math.round(costPerHour * marginMultiplier);
}

// Longest and shortest booking a driver can ask for, in minutes (multiples of RATE_STEP_MIN)
export const RATE_MIN_DURATION = 15;
export const RATE_MAX_DURATION = 480;
export const RATE_STEP_MIN = 15;

/**
 * The host's hourly rate: the price of their 1 hour package (the one price they enter when listing).
 * Chargers with only other packages use the cheapest rate per hour among them.
 */
export function hourlyRateOf(packages = []) {
  const active = packages.filter((p) => p.isActive !== false);
  const hour = active.find((p) => p.durationMin === 60);
  if (hour) return Number(hour.price);
  if (active.length === 0) return null;
  return Math.min(...active.map((p) => (Number(p.price) * 60) / p.durationMin));
}

/**
 * Price for any duration at the host's hourly rate, rounded to 2 decimals.
 */
export function priceForDuration(hourlyRate, durationMin) {
  return Math.round(((hourlyRate * durationMin) / 60) * 100) / 100;
}

/**
 * Rank chargers for a driver. Pure and deterministic: the model only explains the result.
 * Each factor is scaled 0..1 against the other candidates, then weighted by what the driver cares about.
 * Travel plans (route from A to B) can reuse this later by feeding it chargers found along the route.
 */
export const RANK_PRIORITIES = {
  balanced: { power: 0.25, distance: 0.25, rating: 0.25, price: 0.25 },
  fastest: { power: 0.6, distance: 0.15, rating: 0.15, price: 0.1 },
  nearest: { power: 0.1, distance: 0.6, rating: 0.15, price: 0.15 },
  cheapest: { power: 0.1, distance: 0.15, rating: 0.15, price: 0.6 },
  best_rated: { power: 0.1, distance: 0.15, rating: 0.6, price: 0.15 },
};
const KW_OF_TIER = { kW3_3: 3.3, kW7_4: 7.4, kW11: 11, kW22: 22, kW50: 50, kW150: 150 };
const UNRATED = 3; // a charger nobody rated yet is neither good nor bad

export function rankChargers(chargers, priority = 'balanced', top = 3) {
  const weights = RANK_PRIORITIES[priority] || RANK_PRIORITIES.balanced;
  const rows = chargers
    .map((c) => ({
      c,
      kw: KW_OF_TIER[c.kwTier] ?? null,
      rate: hourlyRateOf(c.packages || []),
      rating: c.totalBookings > 0 && c.avgRating > 0 ? c.avgRating : UNRATED,
      km: c.distanceKm ?? null,
    }))
    .filter((r) => r.kw !== null && r.rate !== null);
  if (rows.length === 0) return [];

  const maxKw = Math.max(...rows.map((r) => r.kw));
  const maxKm = Math.max(...rows.map((r) => r.km ?? 0)) || 1;
  const minRate = Math.min(...rows.map((r) => r.rate));

  return rows
    .map((r) => {
      const parts = {
        power: r.kw / maxKw,
        distance: r.km === null ? 0.5 : 1 - r.km / (maxKm * 1.0001),
        rating: (r.rating - 1) / 4,
        price: r.rate > 0 ? minRate / r.rate : 1,
      };
      const score = Object.keys(weights).reduce((sum, k) => sum + weights[k] * parts[k], 0);
      return {
        chargerId: r.c.id,
        name: r.c.name,
        address: r.c.address,
        distanceKm: r.km,
        powerKw: r.kw,
        rating: r.rating,
        rated: r.c.totalBookings > 0,
        hourlyRate: r.rate,
        currency: r.c.packages?.[0]?.currency,
        score: Math.round(score * 1000) / 1000,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

export const chargerService = {
  /**
   * Search chargers with filters
   */
  async searchChargers({
    latitude,
    longitude,
    radius = 10,
    connectorType,
    minKw,
    maxPrice,
    availableFrom,
    availableTo,
    page = 1,
    limit = 20,
  }) {
    // Build where clause
    const where = {
      status: 'active',
      isBlocked: false, // Exclude blocked chargers from public search
    };

    if (connectorType) {
      where.connectorType = connectorType;
    }

    if (minKw) {
      // Map minKw to enum values
      const kwOrder = ['kW3_3', 'kW7_4', 'kW11', 'kW22', 'kW50', 'kW150'];
      const minIndex = kwOrder.findIndex(kw => {
        const kwValue = parseFloat(kw.replace('kW', '').replace('_', '.'));
        return kwValue >= minKw;
      });
      if (minIndex !== -1) {
        where.kwTier = { in: kwOrder.slice(minIndex) };
      }
    }

    // Get all active chargers with packages
    let chargers = await prisma.charger.findMany({
      where,
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        packages: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        availability: true,
      },
    });

    // Filter by price if specified
    if (maxPrice) {
      chargers = chargers.filter(c => 
        c.packages.some(p => parseFloat(p.price) <= maxPrice)
      );
    }

    // Calculate distances and filter by radius
    if (latitude && longitude) {
      chargers = chargers.map(c => ({
        ...c,
        distanceKm: calculateDistance(
          latitude, longitude,
          parseFloat(c.latitude), parseFloat(c.longitude)
        ),
      }));

      // radius 0 = no limit (everything, nearest first)
      if (radius > 0) chargers = chargers.filter(c => c.distanceKm <= radius);
      
      // Sort by distance
      chargers.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // Paginate
    const total = chargers.length;
    const skip = (page - 1) * limit;
    const paginatedChargers = chargers.slice(skip, skip + limit);

    // Format response
    const formattedChargers = paginatedChargers.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      address: c.address,
      city: c.city,
      latitude: parseFloat(c.latitude),
      longitude: parseFloat(c.longitude),
      distanceKm: c.distanceKm ? Math.round(c.distanceKm * 10) / 10 : null,
      connectorType: c.connectorType,
      kwTier: c.kwTier,
      amenities: c.amenities,
      photos: c.photos,
      avgRating: parseFloat(c.avgRating),
      totalBookings: c.totalBookings,
      host: {
        id: c.host.id,
        name: c.host.name,
        avatarUrl: c.host.avatarUrl,
      },
      packages: c.packages.map(p => ({
        id: p.id,
        name: p.name,
        durationMin: p.durationMin,
        price: parseFloat(p.price),
        currency: p.currency,
      })),
      lowestPrice: c.packages.length > 0 ? parseFloat(c.packages[0].price) : null,
    }));

    return {
      chargers: formattedChargers,
      pagination: {
        page,
        limit,
        total,
      },
    };
  },

  /**
   * Get charger by ID with full details
   */
  async getChargerById(chargerId, userId = null) {
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            _count: {
              select: { chargersOwned: true },
            },
          },
        },
        packages: {
          where: { isActive: true },
          orderBy: { durationMin: 'asc' },
        },
        availability: {
          orderBy: { dayOfWeek: 'asc' },
        },
        driverRatings: {
          include: {
            driver: {
              select: { name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    // Get host's average rating
    const hostRatingStats = await prisma.driverRating.aggregate({
      where: { charger: { hostId: charger.hostId } },
      _avg: { rating: true },
      _count: true,
    });

    return {
      id: charger.id,
      name: charger.name,
      description: charger.description,
      address: charger.address,
      city: charger.city,
      latitude: parseFloat(charger.latitude),
      longitude: parseFloat(charger.longitude),
      connectorType: charger.connectorType,
      kwTier: charger.kwTier,
      amenities: charger.amenities,
      photos: charger.photos,
      status: charger.status,
      avgRating: parseFloat(charger.avgRating),
      totalBookings: charger.totalBookings,
      host: {
        id: charger.host.id,
        name: charger.host.name,
        avatarUrl: charger.host.avatarUrl,
        memberSince: charger.host.createdAt,
        chargersCount: charger.host._count.chargersOwned,
        avgRating: hostRatingStats._avg.rating || 0,
        totalReviews: hostRatingStats._count,
      },
      // Every duration is priced from this one rate (see priceForDuration)
      hourlyRate: hourlyRateOf(charger.packages),
      packages: charger.packages.map(p => ({
        id: p.id,
        name: p.name,
        durationMin: p.durationMin,
        price: parseFloat(p.price),
        currency: p.currency,
      })),
      availability: charger.availability.map(a => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isAvailable: a.isAvailable,
      })),
      reviews: charger.driverRatings.map(r => ({
        rating: r.rating,
        reviewText: r.reviewText,
        createdAt: r.createdAt,
        driver: {
          name: r.driver.name,
          avatarUrl: r.driver.avatarUrl,
        },
      })),
      isOwner: userId === charger.hostId,
    };
  },

  /**
   * Create a new charger listing
   */
  async createCharger(hostId, data) {
    // The wallet minimum balance is the damage deposit; no deposit, no listing
    await walletService.assertDepositMet(hostId, 'list a charger');

    const {
      name,
      description,
      address,
      city = 'Bengaluru',
      latitude,
      longitude,
      connectorType,
      kwTier,
      amenities = [],
      photos = [],
      packages,
      availability,
    } = data;

    // Calculate suggested price
    const suggestedPrice = calculateSuggestedPrice(kwTier, city);

    // Create charger with packages and availability
    const charger = await prisma.charger.create({
      data: {
        hostId,
        name,
        description,
        address,
        city,
        latitude,
        longitude,
        connectorType,
        kwTier,
        amenities,
        photos,
        suggestedPrice,
        packages: {
          create: packages.map(p => ({
            name: p.name,
            durationMin: p.durationMin,
            price: p.price,
            currency: p.currency || 'USD',
          })),
        },
        availability: availability ? {
          create: availability.map(a => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            isAvailable: a.isAvailable !== false,
          })),
        } : undefined,
      },
      include: {
        packages: true,
        availability: true,
      },
    });

    return {
      charger: {
        id: charger.id,
        name: charger.name,
        suggestedPrice,
        priceExplanation: `Based on ${kwTier.replace('kW', '').replace('_', '.')}kW tier and ${city} location, $${suggestedPrice}/hr is competitive for this area.`,
      },
    };
  },

  /**
   * Update a charger listing
   */
  async updateCharger(chargerId, hostId, data) {
    // Verify ownership
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    if (charger.hostId !== hostId) {
      throw new ForbiddenError('You do not own this charger');
    }

    const {
      name,
      description,
      address,
      amenities,
      photos,
      status,
    } = data;

    const updated = await prisma.charger.update({
      where: { id: chargerId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(address && { address }),
        ...(amenities && { amenities }),
        ...(photos && { photos }),
        ...(status && { status }),
      },
    });

    return updated;
  },

  /**
   * Update packages for a charger
   */
  async updatePackages(chargerId, hostId, packages) {
    // Verify ownership
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    if (charger.hostId !== hostId) {
      throw new ForbiddenError('You do not own this charger');
    }

    // Delete existing packages and create new ones
    await prisma.$transaction([
      prisma.timePackage.deleteMany({
        where: { chargerId },
      }),
      ...packages.map(p => 
        prisma.timePackage.create({
          data: {
            chargerId,
            name: p.name,
            durationMin: p.durationMin,
            price: p.price,
            currency: p.currency || 'USD',
            isActive: p.isActive !== false,
          },
        })
      ),
    ]);

    return prisma.timePackage.findMany({
      where: { chargerId },
    });
  },

  /**
   * Update availability for a charger
   */
  async updateAvailability(chargerId, hostId, availability) {
    // Verify ownership
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    if (charger.hostId !== hostId) {
      throw new ForbiddenError('You do not own this charger');
    }

    // Delete existing availability and create new ones
    await prisma.$transaction([
      prisma.availability.deleteMany({
        where: { chargerId },
      }),
      ...availability.map(a => 
        prisma.availability.create({
          data: {
            chargerId,
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
            isAvailable: a.isAvailable !== false,
          },
        })
      ),
    ]);

    return prisma.availability.findMany({
      where: { chargerId },
      orderBy: { dayOfWeek: 'asc' },
    });
  },

  /**
   * Delete a charger
   */
  async deleteCharger(chargerId, hostId) {
    // Verify ownership
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
      include: {
        bookings: {
          where: {
            status: { in: ['pending', 'authorized', 'in_progress'] },
          },
        },
      },
    });

    if (!charger) {
      throw new NotFoundError('Charger');
    }

    if (charger.hostId !== hostId) {
      throw new ForbiddenError('You do not own this charger');
    }

    // Check for active bookings
    if (charger.bookings.length > 0) {
      throw new ValidationError('Cannot delete charger with active bookings');
    }

    await prisma.charger.delete({
      where: { id: chargerId },
    });

    return { deleted: true };
  },

  /**
   * Get host's chargers
   */
  async getHostChargers(hostId) {
    const chargers = await prisma.charger.findMany({
      where: { hostId },
      include: {
        packages: { where: { isActive: true } },
        _count: {
          select: {
            bookings: true,
            driverRatings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return chargers.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      connectorType: c.connectorType,
      kwTier: c.kwTier,
      status: c.status,
      avgRating: parseFloat(c.avgRating),
      totalBookings: c.totalBookings,
      packagesCount: c.packages.length,
      createdAt: c.createdAt,
    }));
  },
};

export default chargerService;
