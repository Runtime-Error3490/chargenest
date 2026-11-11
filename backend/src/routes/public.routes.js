import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api/public/stats
 * Get public platform statistics for homepage display
 * No authentication required
 */
router.get('/stats', async (req, res, next) => {
  try {
    // Fetch real counts from database in parallel
    const [
      totalUsers,
      totalChargers,
      totalBookings,
      avgRating
    ] = await Promise.all([
      // Count all users (Early Adopters)
      prisma.user.count(),
      
      // Count all active chargers (Host Chargers) - use status enum
      prisma.charger.count({
        where: {
          status: 'active'
        }
      }),
      
      // Count all completed bookings
      prisma.booking.count({
        where: {
          status: 'completed'
        }
      }),
      
      // Get average rating from driver ratings
      prisma.driverRating.aggregate({
        _avg: {
          rating: true
        }
      })
    ]);

    // Format the average rating
    const rating = avgRating._avg.rating 
      ? `${Number(avgRating._avg.rating).toFixed(1)}★` 
      : '5.0★';

    // Return stats in format expected by frontend
    successResponse(res, {
      earlyAdopters: totalUsers,
      hostChargers: totalChargers,
      completedBookings: totalBookings,
      avgRating: rating,
      pilotCity: 'Bengaluru' // Static for now, can be made dynamic later
    });
    
  } catch (error) {
    next(error);
  }
});

export default router;
