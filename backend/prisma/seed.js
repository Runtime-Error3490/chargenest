import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Demo account configuration - override via environment variables
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'ChargeNest2026!';
const DEMO_DRIVER_EMAIL = process.env.DEMO_DRIVER_EMAIL || 'client@demo.com';
const DEMO_HOST_EMAIL = process.env.DEMO_HOST_EMAIL || 'host@demo.com';
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@evcharge.com';
const DEMO_DUAL_EMAIL = process.env.DEMO_DUAL_EMAIL || 'clienthost@demo.com';

// High-quality EV charging stock photos from Unsplash (free to use)
// Using direct Unsplash Source URLs which are more reliable for production
const stockPhotos = {
  homeCharger: [
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80', // Tesla charging
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80', // EV plugged in
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=800&q=80', // Home wall charger
  ],
  cafeCharger: [
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80', // Public charging
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80', // EV charging point
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80', // Supercharger style
  ],
  apartmentCharger: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80', // EV plugged in
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80', // Parking charger
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=800&q=80', // Underground parking
  ],
  techParkCharger: [
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80', // Modern charging
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80', // Tech park charger
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80', // Multiple bays
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80', // Premium charging
  ],
  residentialCharger: [
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=800&q=80', // Home setup
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80', // Residential
  ],
  mallCharger: [
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80', // Mall parking
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80', // Retail station
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80', // Multiple chargers
  ],
  hotelCharger: [
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80', // Hotel charging
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80', // Premium charger
  ],
};

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Create demo users with realistic names
  const driver = await prisma.user.upsert({
    where: { email: DEMO_DRIVER_EMAIL },
    update: {},
    create: {
      email: DEMO_DRIVER_EMAIL,
      passwordHash,
      name: 'Alex Thompson',
      phone: '+14155551234',
      isVerified: true,
      roles: {
        create: [{ role: 'driver' }],
      },
    },
  });

  const host = await prisma.user.upsert({
    where: { email: DEMO_HOST_EMAIL },
    update: {},
    create: {
      email: DEMO_HOST_EMAIL,
      passwordHash,
      name: 'Sarah Mitchell',
      phone: '+14155551235',
      isVerified: true,
      roles: {
        create: [{ role: 'host' }],
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      name: 'Admin User',
      phone: '+14155551236',
      isVerified: true,
      roles: {
        create: [{ role: 'admin' }],
      },
    },
  });

  // Create a user who is both client and host
  const dualUser = await prisma.user.upsert({
    where: { email: DEMO_DUAL_EMAIL },
    update: {},
    create: {
      email: DEMO_DUAL_EMAIL,
      passwordHash,
      name: 'Michael Chen',
      phone: '+14155551237',
      isVerified: true,
      roles: {
        create: [{ role: 'driver' }, { role: 'host' }],
      },
    },
  });

  console.log('✅ Created users');

  // Demo wallets with USD amounts
  const demoWallets = [
    { user: driver, amount: 500 },
    { user: host, amount: 100 },
    { user: dualUser, amount: 300 },
  ];
  for (const { user, amount } of demoWallets) {
    const credited = await prisma.user.updateMany({
      where: { id: user.id, walletBalance: 0 },
      data: { walletBalance: amount },
    });
    if (credited.count > 0) {
      await prisma.walletTransaction.create({
        data: {
          userId: user.id,
          type: 'topup',
          amount,
          balanceAfter: amount,
          note: 'Demo seed credit (sandbox)',
        },
      });
    }
  }
  console.log('✅ Funded demo wallets');

  // Create chargers in Bengaluru with USD pricing
  const chargers = [
    {
      hostId: host.id,
      name: "Sarah's Home Charger",
      description: 'Well-maintained 7.4kW AC charger in covered parking. Pet-friendly home with easy access. Perfect for a quick top-up while you grab coffee nearby!',
      address: '123 4th Cross, HSR Layout Sector 2, Bengaluru 560102',
      city: 'Bengaluru',
      latitude: 12.9141,
      longitude: 77.6411,
      connectorType: 'Type2',
      kwTier: 'kW7_4',
      amenities: ['parking', 'wifi', 'restroom'],
      photos: stockPhotos.homeCharger,
      suggestedPrice: 5,
      packages: [
        { name: 'Quick Charge', durationMin: 30, price: 3 },
        { name: 'Standard', durationMin: 60, price: 5 },
        { name: 'Extended', durationMin: 120, price: 9 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '08:00', endTime: '22:00' },
        { dayOfWeek: 1, startTime: '08:00', endTime: '22:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '22:00' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '22:00' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '22:00' },
        { dayOfWeek: 5, startTime: '08:00', endTime: '22:00' },
        { dayOfWeek: 6, startTime: '08:00', endTime: '22:00' },
      ],
    },
    {
      hostId: host.id,
      name: 'Quick Charge @ Brew House',
      description: 'Fast 22kW charger at our popular cafe. Enjoy artisan coffee and pastries while your EV charges. Free WiFi and comfortable seating area.',
      address: '45 5th Block, Koramangala, Bengaluru 560095',
      city: 'Bengaluru',
      latitude: 12.9352,
      longitude: 77.6245,
      connectorType: 'CCS2',
      kwTier: 'kW22',
      amenities: ['cafe', 'wifi', 'seating', 'restroom'],
      photos: stockPhotos.cafeCharger,
      suggestedPrice: 10,
      packages: [
        { name: 'Quick Boost', durationMin: 30, price: 6 },
        { name: 'Standard', durationMin: 60, price: 10 },
        { name: 'Extended', durationMin: 120, price: 18 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '07:00', endTime: '23:00' },
        { dayOfWeek: 1, startTime: '07:00', endTime: '23:00' },
        { dayOfWeek: 2, startTime: '07:00', endTime: '23:00' },
        { dayOfWeek: 3, startTime: '07:00', endTime: '23:00' },
        { dayOfWeek: 4, startTime: '07:00', endTime: '23:00' },
        { dayOfWeek: 5, startTime: '07:00', endTime: '23:00' },
        { dayOfWeek: 6, startTime: '07:00', endTime: '23:00' },
      ],
    },
    {
      hostId: host.id,
      name: 'Skyline Apartments Charger',
      description: 'Shared charger in premium apartment complex. 24/7 security with visitor parking available. Underground parking protects your car from weather.',
      address: '78 100 Feet Road, Indiranagar, Bengaluru 560038',
      city: 'Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
      connectorType: 'Type2',
      kwTier: 'kW11',
      amenities: ['parking', 'security', 'restroom'],
      photos: stockPhotos.apartmentCharger,
      suggestedPrice: 7,
      packages: [
        { name: 'Quick Charge', durationMin: 30, price: 4 },
        { name: 'Standard', durationMin: 60, price: 7 },
        { name: 'Extended', durationMin: 120, price: 12 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '06:00', endTime: '22:00' },
        { dayOfWeek: 1, startTime: '06:00', endTime: '22:00' },
        { dayOfWeek: 2, startTime: '06:00', endTime: '22:00' },
        { dayOfWeek: 3, startTime: '06:00', endTime: '22:00' },
        { dayOfWeek: 4, startTime: '06:00', endTime: '22:00' },
        { dayOfWeek: 5, startTime: '06:00', endTime: '22:00' },
        { dayOfWeek: 6, startTime: '06:00', endTime: '22:00' },
      ],
    },
    {
      hostId: dualUser.id,
      name: 'TechHub Fast Charger',
      description: 'High-speed 50kW DC fast charger in tech park. Perfect for quick top-ups during work. Food court nearby with multiple dining options.',
      address: '15 ITPL Main Road, Whitefield, Bengaluru 560066',
      city: 'Bengaluru',
      latitude: 12.9698,
      longitude: 77.7500,
      connectorType: 'CCS2',
      kwTier: 'kW50',
      amenities: ['parking', 'security', 'cafe', 'wifi'],
      photos: stockPhotos.techParkCharger,
      suggestedPrice: 15,
      packages: [
        { name: 'Quick Boost', durationMin: 30, price: 8 },
        { name: 'Standard', durationMin: 60, price: 15 },
        { name: 'Full Charge', durationMin: 90, price: 20 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 1, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 2, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 3, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 4, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 5, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 6, startTime: '00:00', endTime: '23:59' },
      ],
    },
    {
      hostId: host.id,
      name: 'Peaceful Gardens Charger',
      description: 'Quiet residential area charger. Perfect for overnight charging with secure parking. Wake up to a fully charged EV!',
      address: '234 15th Cross, JP Nagar 6th Phase, Bengaluru 560078',
      city: 'Bengaluru',
      latitude: 12.8891,
      longitude: 77.5852,
      connectorType: 'Type2',
      kwTier: 'kW3_3',
      amenities: ['parking', 'security'],
      photos: stockPhotos.residentialCharger,
      suggestedPrice: 3,
      packages: [
        { name: 'Short', durationMin: 60, price: 3 },
        { name: 'Half Day', durationMin: 240, price: 10 },
        { name: 'Overnight', durationMin: 480, price: 18 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '18:00', endTime: '23:59' },
        { dayOfWeek: 1, startTime: '18:00', endTime: '23:59' },
        { dayOfWeek: 2, startTime: '18:00', endTime: '23:59' },
        { dayOfWeek: 3, startTime: '18:00', endTime: '23:59' },
        { dayOfWeek: 4, startTime: '18:00', endTime: '23:59' },
        { dayOfWeek: 5, startTime: '18:00', endTime: '23:59' },
        { dayOfWeek: 6, startTime: '18:00', endTime: '23:59' },
      ],
    },
    {
      hostId: dualUser.id,
      name: 'Phoenix Mall Charger',
      description: 'Convenient charger at Phoenix Marketcity mall. Charge while you shop! Validated parking available for mall visitors.',
      address: '142 Whitefield Main Road, Bengaluru 560048',
      city: 'Bengaluru',
      latitude: 12.9970,
      longitude: 77.6961,
      connectorType: 'CCS2',
      kwTier: 'kW22',
      amenities: ['parking', 'security', 'cafe', 'restroom', 'wifi'],
      photos: stockPhotos.mallCharger,
      suggestedPrice: 8,
      packages: [
        { name: 'Quick Shop', durationMin: 30, price: 5 },
        { name: 'Standard', durationMin: 60, price: 8 },
        { name: 'Movie Time', durationMin: 180, price: 20 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '10:00', endTime: '22:00' },
        { dayOfWeek: 1, startTime: '10:00', endTime: '22:00' },
        { dayOfWeek: 2, startTime: '10:00', endTime: '22:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '22:00' },
        { dayOfWeek: 4, startTime: '10:00', endTime: '22:00' },
        { dayOfWeek: 5, startTime: '10:00', endTime: '23:00' },
        { dayOfWeek: 6, startTime: '10:00', endTime: '23:00' },
      ],
    },
    {
      hostId: host.id,
      name: 'Grand Hotel Charger',
      description: 'Premium charging at The Grand Hotel. Valet service available. Enjoy fine dining or spa services while your vehicle charges.',
      address: '89 MG Road, Bengaluru 560001',
      city: 'Bengaluru',
      latitude: 12.9758,
      longitude: 77.6097,
      connectorType: 'Type2',
      kwTier: 'kW11',
      amenities: ['parking', 'security', 'cafe', 'wifi', 'restroom'],
      photos: stockPhotos.hotelCharger,
      suggestedPrice: 12,
      packages: [
        { name: 'Quick Stay', durationMin: 60, price: 12 },
        { name: 'Dinner & Charge', durationMin: 120, price: 20 },
        { name: 'Overnight', durationMin: 480, price: 35 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 1, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 2, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 3, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 4, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 5, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 6, startTime: '00:00', endTime: '23:59' },
      ],
    },
  ];

  for (const chargerData of chargers) {
    const { packages, availability, ...charger } = chargerData;

    // Check if charger already exists (using unique constraint fields)
    const existingCharger = await prisma.charger.findFirst({
      where: {
        hostId: charger.hostId,
        name: charger.name,
        address: charger.address,
      },
    });

    if (existingCharger) {
      console.log(`  ⏩ Skipped (exists): ${charger.name}`);
      continue;
    }

    const createdCharger = await prisma.charger.create({
      data: {
        ...charger,
        packages: {
          create: packages,
        },
        availability: {
          create: availability,
        },
      },
    });

    console.log(`  ✅ Created charger: ${createdCharger.name}`);
  }

  // Create an agent for the demo driver
  await prisma.agent.upsert({
    where: { id: 'seed-agent-001' },
    update: {},
    create: {
      id: 'seed-agent-001',
      userId: driver.id,
      name: 'Charging Concierge',
      model: 'openai/gpt-3.5-turbo',
      provider: 'openrouter',
      status: 'active',
    },
  });

  console.log('✅ Created default agent');

  // Create mock bookings for the driver
  const allChargers = await prisma.charger.findMany({
    include: { packages: true },
  });

  if (allChargers.length > 0) {
    const now = new Date();
    
    // Helper to create dates
    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };
    
    const addHours = (date, hours) => {
      const result = new Date(date);
      result.setHours(result.getHours() + hours);
      return result;
    };

    const mockBookings = [
      // Completed booking - 5 days ago
      {
        driverId: driver.id,
        chargerId: allChargers[0].id,
        packageId: allChargers[0].packages[1]?.id, // Standard package
        scheduledStart: addDays(addHours(now, -120), 0), // 5 days ago
        scheduledEnd: addHours(addDays(now, -5), 1),
        status: 'completed',
        baseAmount: (allChargers[0].packages[1]?.price || 5) * 0.93,
        totalAmount: allChargers[0].packages[1]?.price || 5,
        platformFee: (allChargers[0].packages[1]?.price || 5) * 0.07,
      },
      // Completed booking - 12 days ago
      {
        driverId: driver.id,
        chargerId: allChargers[1]?.id || allChargers[0].id,
        packageId: allChargers[1]?.packages[0]?.id || allChargers[0].packages[0]?.id,
        scheduledStart: addDays(now, -12),
        scheduledEnd: addHours(addDays(now, -12), 0.5),
        status: 'completed',
        baseAmount: (allChargers[1]?.packages[0]?.price || 6) * 0.93,
        totalAmount: allChargers[1]?.packages[0]?.price || 6,
        platformFee: (allChargers[1]?.packages[0]?.price || 6) * 0.07,
      },
      // Completed booking - 20 days ago
      {
        driverId: driver.id,
        chargerId: allChargers[2]?.id || allChargers[0].id,
        packageId: allChargers[2]?.packages[2]?.id || allChargers[0].packages[2]?.id,
        scheduledStart: addDays(now, -20),
        scheduledEnd: addHours(addDays(now, -20), 2),
        status: 'completed',
        baseAmount: (allChargers[2]?.packages[2]?.price || 12) * 0.93,
        totalAmount: allChargers[2]?.packages[2]?.price || 12,
        platformFee: (allChargers[2]?.packages[2]?.price || 12) * 0.07,
      },
      // Authorized booking - tomorrow (ready to use)
      {
        driverId: driver.id,
        chargerId: allChargers[0].id,
        packageId: allChargers[0].packages[1]?.id,
        scheduledStart: addHours(addDays(now, 1), 10), // Tomorrow at 10am
        scheduledEnd: addHours(addDays(now, 1), 11),
        status: 'authorized',
        baseAmount: (allChargers[0].packages[1]?.price || 5) * 0.93,
        totalAmount: allChargers[0].packages[1]?.price || 5,
        platformFee: (allChargers[0].packages[1]?.price || 5) * 0.07,
      },
      // Authorized booking - in 3 days
      {
        driverId: driver.id,
        chargerId: allChargers[3]?.id || allChargers[0].id,
        packageId: allChargers[3]?.packages[1]?.id || allChargers[0].packages[1]?.id,
        scheduledStart: addHours(addDays(now, 3), 14), // 3 days from now at 2pm
        scheduledEnd: addHours(addDays(now, 3), 15),
        status: 'authorized',
        baseAmount: (allChargers[3]?.packages[1]?.price || 15) * 0.93,
        totalAmount: allChargers[3]?.packages[1]?.price || 15,
        platformFee: (allChargers[3]?.packages[1]?.price || 15) * 0.07,
      },
      // Cancelled booking - was for yesterday
      {
        driverId: driver.id,
        chargerId: allChargers[1]?.id || allChargers[0].id,
        packageId: allChargers[1]?.packages[1]?.id || allChargers[0].packages[1]?.id,
        scheduledStart: addDays(now, -1),
        scheduledEnd: addHours(addDays(now, -1), 1),
        status: 'cancelled',
        baseAmount: (allChargers[1]?.packages[1]?.price || 10) * 0.93,
        totalAmount: allChargers[1]?.packages[1]?.price || 10,
        platformFee: 0,
      },
      // Additional completed bookings for revenue data - last month
      {
        driverId: driver.id,
        chargerId: allChargers[0].id,
        packageId: allChargers[0].packages[2]?.id || allChargers[0].packages[0]?.id,
        scheduledStart: addDays(now, -35),
        scheduledEnd: addHours(addDays(now, -35), 2),
        status: 'completed',
        baseAmount: 18 * 0.93,
        totalAmount: 18,
        platformFee: 18 * 0.07,
      },
      {
        driverId: driver.id,
        chargerId: allChargers[1]?.id || allChargers[0].id,
        packageId: allChargers[1]?.packages[0]?.id || allChargers[0].packages[0]?.id,
        scheduledStart: addDays(now, -40),
        scheduledEnd: addHours(addDays(now, -40), 1),
        status: 'completed',
        baseAmount: 8 * 0.93,
        totalAmount: 8,
        platformFee: 8 * 0.07,
      },
      {
        driverId: driver.id,
        chargerId: allChargers[2]?.id || allChargers[0].id,
        packageId: allChargers[2]?.packages[1]?.id || allChargers[0].packages[1]?.id,
        scheduledStart: addDays(now, -45),
        scheduledEnd: addHours(addDays(now, -45), 1),
        status: 'completed',
        baseAmount: 12 * 0.93,
        totalAmount: 12,
        platformFee: 12 * 0.07,
      },
    ];

    // Check if bookings already exist - also check for payments
    const existingBookings = await prisma.booking.count({
      where: { driverId: driver.id },
    });
    const existingPayments = await prisma.payment.count({
      where: { booking: { driverId: driver.id } },
    });

    // Recreate if we don't have enough bookings OR if we're missing payments
    if (existingBookings < 8 || existingPayments < 5) {
      // Give back the money held for the old upcoming bookings before they are deleted
      const oldHolds = await prisma.booking.findMany({
        where: { driverId: driver.id, status: 'authorized' },
        select: { id: true, totalAmount: true },
      });
      for (const old of oldHolds) {
        const hold = await prisma.walletTransaction.findFirst({ where: { bookingId: old.id, type: 'booking_hold' } });
        if (!hold) continue;
        await prisma.user.update({
          where: { id: driver.id },
          data: { walletHeld: { decrement: old.totalAmount }, walletBalance: { increment: old.totalAmount } },
        });
        await prisma.walletTransaction.updateMany({ where: { bookingId: old.id }, data: { bookingId: null } });
      }

      // Delete existing bookings and payments to recreate them
      await prisma.payment.deleteMany({
        where: { booking: { driverId: driver.id } },
      });
      await prisma.booking.deleteMany({
        where: { driverId: driver.id },
      });
      
      for (const bookingData of mockBookings) {
        if (bookingData.chargerId && bookingData.packageId) {
          // A confirmed booking is paid from the wallet, so its amount must really be held
          const needsHold = bookingData.status === 'authorized';
          if (needsHold) {
            const total = Number(bookingData.totalAmount);
            const held = await prisma.user.updateMany({
              where: { id: driver.id, walletBalance: { gte: total + (parseFloat(process.env.WALLET_DEPOSIT || '25')) } },
              data: { walletBalance: { decrement: total }, walletHeld: { increment: total } },
            });
            if (held.count === 0) {
              console.warn(`⚠️  Skipped an upcoming booking of $${total}: the demo driver's wallet cannot hold it`);
              continue;
            }
          }

          const booking = await prisma.booking.create({
            data: bookingData,
          });

          if (needsHold) {
            const { walletBalance } = await prisma.user.findUnique({ where: { id: driver.id }, select: { walletBalance: true } });
            await prisma.walletTransaction.create({
              data: {
                userId: driver.id,
                type: 'booking_hold',
                amount: bookingData.totalAmount,
                balanceAfter: walletBalance,
                bookingId: booking.id,
                note: 'Held for booking (demo seed)',
              },
            });
            await prisma.session.create({ data: { bookingId: booking.id, status: 'awaiting_start' } });
          }
          
          // Create payment records for completed and authorized bookings
          if (bookingData.status === 'completed') {
            await prisma.payment.create({
              data: {
                bookingId: booking.id,
                authorizedAmount: bookingData.totalAmount,
                platformFeeAmount: bookingData.platformFee,
                hostPayoutAmount: bookingData.baseAmount,
                capturedAmount: bookingData.totalAmount,
                currency: 'USD',
                status: 'captured',
                paypalOrderId: `MOCK_ORDER_${booking.id.substring(0, 8)}`,
                paypalAuthId: `MOCK_AUTH_${booking.id.substring(0, 8)}`,
                paypalCaptureId: `MOCK_CAPTURE_${booking.id.substring(0, 8)}`,
                authorizedAt: bookingData.scheduledStart,
                capturedAt: bookingData.scheduledEnd,
              },
            });
          } else if (bookingData.status === 'authorized') {
            await prisma.payment.create({
              data: {
                bookingId: booking.id,
                authorizedAmount: bookingData.totalAmount,
                platformFeeAmount: bookingData.platformFee,
                hostPayoutAmount: bookingData.baseAmount,
                currency: 'USD',
                status: 'authorized',
                paypalOrderId: `MOCK_ORDER_${booking.id.substring(0, 8)}`,
                paypalAuthId: `MOCK_AUTH_${booking.id.substring(0, 8)}`,
                authorizedAt: new Date(),
              },
            });
          }
        }
      }
      console.log(`✅ Created ${mockBookings.length} mock bookings with payments for driver`);
    } else {
      console.log(`⏩ Skipped bookings (${existingBookings} already exist)`);
    }
  }

  console.log(`
🎉 Seed completed!

Demo Accounts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Configure via environment variables:
  DEMO_PASSWORD, DEMO_DRIVER_EMAIL,
  DEMO_HOST_EMAIL, DEMO_ADMIN_EMAIL,
  DEMO_DUAL_EMAIL

Or use defaults (see seed.js)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chargers created: ${chargers.length}
`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
