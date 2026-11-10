import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
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

      chargers = chargers.filter(c => c.distanceKm <= radius);
      
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
            currency: p.currency || 'INR',
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
        priceExplanation: `Based on ${kwTier.replace('kW', '').replace('_', '.')}kW tier and ${city} location, ₹${suggestedPrice}/hr is competitive for this area.`,
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
            currency: p.currency || 'INR',
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
