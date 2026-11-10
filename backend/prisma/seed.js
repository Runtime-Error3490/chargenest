import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Stock photos for EV chargers from Unsplash (free to use)
const stockPhotos = {
  homeCharger: [
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80', // EV charging at home
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // Electric car plugged in
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?w=800&q=80', // Home garage charger
  ],
  cafeCharger: [
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=800&q=80', // Public charging station
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&q=80', // EV charging point
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?w=800&q=80', // Tesla supercharger style
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80', // EV charging
  ],
  apartmentCharger: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // EV plugged in
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?w=800&q=80', // Charging station
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?w=800&q=80', // Parking garage
  ],
  techParkCharger: [
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&q=80', // Modern charging
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=800&q=80', // Commercial station
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?w=800&q=80', // Fast charger
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80', // EV charging
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // Car plugged in
  ],
  residentialCharger: [
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?w=800&q=80', // Home setup
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&q=80', // Residential charging
  ],
};

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password (REDACTED_PASSWORD)
  const passwordHash = await bcrypt.hash('REDACTED_PASSWORD', 10);

  // Create demo users
  const driver = await prisma.user.upsert({
    where: { email: 'demo_driver@example.com' },
    update: {},
    create: {
      email: 'demo_driver@example.com',
      passwordHash,
      name: 'Rahul Kumar',
      phone: '+919876543210',
      paypalEmail: 'sb-buyer@personal.example.com',
      isVerified: true,
      roles: {
        create: [{ role: 'driver' }],
      },
    },
  });

  const host = await prisma.user.upsert({
    where: { email: 'demo_host@example.com' },
    update: {},
    create: {
      email: 'demo_host@example.com',
      passwordHash,
      name: 'Priya Sharma',
      phone: '+919876543211',
      paypalEmail: 'sb-seller@business.example.com',
      isVerified: true,
      roles: {
        create: [{ role: 'host' }],
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'demo_admin@example.com' },
    update: {},
    create: {
      email: 'demo_admin@example.com',
      passwordHash,
      name: 'Admin User',
      phone: '+919876543212',
      isVerified: true,
      roles: {
        create: [{ role: 'admin' }],
      },
    },
  });

  // Create a user who is both client and host
  const dualUser = await prisma.user.upsert({
    where: { email: 'clientdemo_host@example.com' },
    update: {},
    create: {
      email: 'clientdemo_host@example.com',
      passwordHash,
      name: 'Arjun Nair',
      phone: '+919876543213',
      paypalEmail: 'sb-dual@personal.example.com',
      isVerified: true,
      roles: {
        create: [{ role: 'driver' }, { role: 'host' }],
      },
    },
  });

  console.log('✅ Created users');

  // Demo wallets: the minimum balance is a damage deposit, so seeded users start above it.
  // Only credits wallets that are still empty, so re-running the seed never adds money twice.
  const demoWallets = [
    { user: driver, amount: 5000 },
    { user: host, amount: 1000 },
    { user: dualUser, amount: 3000 },
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

  // Create chargers in Bengaluru
  const chargers = [
    {
      hostId: host.id,
      name: "Priya's Home Charger",
      description: 'Well-maintained 7.4kW AC charger in covered parking. Pet-friendly!',
      address: '123 4th Cross, HSR Layout Sector 2, Bengaluru 560102',
      city: 'Bengaluru',
      latitude: 12.9141,
      longitude: 77.6411,
      connectorType: 'Type2',
      kwTier: 'kW7_4',
      amenities: ['parking', 'wifi', 'restroom'],
      photos: stockPhotos.homeCharger,
      suggestedPrice: 140,
      packages: [
        { name: 'Quick Charge', durationMin: 30, price: 75 },
        { name: 'Standard', durationMin: 60, price: 140 },
        { name: 'Extended', durationMin: 120, price: 260 },
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
      name: 'Quick Charge Koramangala',
      description: 'Fast 22kW charger at a cafe. Enjoy coffee while you charge!',
      address: '45 5th Block, Koramangala, Bengaluru 560095',
      city: 'Bengaluru',
      latitude: 12.9352,
      longitude: 77.6245,
      connectorType: 'CCS2',
      kwTier: 'kW22',
      amenities: ['cafe', 'wifi', 'seating'],
      photos: stockPhotos.cafeCharger,
      suggestedPrice: 280,
      packages: [
        { name: 'Quick Boost', durationMin: 30, price: 150 },
        { name: 'Standard', durationMin: 60, price: 280 },
        { name: 'Extended', durationMin: 120, price: 520 },
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
      name: 'Indiranagar Apartment Charger',
      description: 'Shared charger in apartment complex. Visitor parking available.',
      address: '78 100 Feet Road, Indiranagar, Bengaluru 560038',
      city: 'Bengaluru',
      latitude: 12.9784,
      longitude: 77.6408,
      connectorType: 'Type2',
      kwTier: 'kW11',
      amenities: ['parking', 'security'],
      photos: stockPhotos.apartmentCharger,
      suggestedPrice: 180,
      packages: [
        { name: 'Quick Charge', durationMin: 30, price: 95 },
        { name: 'Standard', durationMin: 60, price: 180 },
        { name: 'Extended', durationMin: 120, price: 340 },
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
      name: 'Whitefield Tech Park',
      description: 'Business charger in tech park. Entry after 6 PM and weekends.',
      address: '15 ITPL Main Road, Whitefield, Bengaluru 560066',
      city: 'Bengaluru',
      latitude: 12.9698,
      longitude: 77.7500,
      connectorType: 'CCS2',
      kwTier: 'kW50',
      amenities: ['parking', 'security', 'food_court'],
      photos: stockPhotos.techParkCharger,
      suggestedPrice: 400,
      packages: [
        { name: 'Quick Boost', durationMin: 30, price: 220 },
        { name: 'Standard', durationMin: 60, price: 400 },
        { name: 'Full Charge', durationMin: 90, price: 560 },
      ],
      availability: [
        { dayOfWeek: 0, startTime: '00:00', endTime: '23:59' }, // Sunday all day
        { dayOfWeek: 1, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 2, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 3, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 4, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 5, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 6, startTime: '00:00', endTime: '23:59' }, // Saturday all day
      ],
    },
    {
      hostId: host.id,
      name: 'JP Nagar Home Charger',
      description: 'Quiet residential area. Perfect for overnight charging.',
      address: '234 15th Cross, JP Nagar 6th Phase, Bengaluru 560078',
      city: 'Bengaluru',
      latitude: 12.8891,
      longitude: 77.5852,
      connectorType: 'Type2',
      kwTier: 'kW3_3',
      amenities: ['parking', 'quiet'],
      photos: stockPhotos.residentialCharger,
      suggestedPrice: 80,
      packages: [
        { name: 'Short', durationMin: 60, price: 80 },
        { name: 'Half Day', durationMin: 240, price: 280 },
        { name: 'Overnight', durationMin: 480, price: 500 },
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
        baseAmount: (allChargers[0].packages[1]?.price || 140) * 0.93,
        totalAmount: allChargers[0].packages[1]?.price || 140,
        platformFee: (allChargers[0].packages[1]?.price || 140) * 0.07,
      },
      // Completed booking - 12 days ago
      {
        driverId: driver.id,
        chargerId: allChargers[1]?.id || allChargers[0].id,
        packageId: allChargers[1]?.packages[0]?.id || allChargers[0].packages[0]?.id,
        scheduledStart: addDays(now, -12),
        scheduledEnd: addHours(addDays(now, -12), 0.5),
        status: 'completed',
        baseAmount: (allChargers[1]?.packages[0]?.price || 150) * 0.93,
        totalAmount: allChargers[1]?.packages[0]?.price || 150,
        platformFee: (allChargers[1]?.packages[0]?.price || 150) * 0.07,
      },
      // Completed booking - 20 days ago
      {
        driverId: driver.id,
        chargerId: allChargers[2]?.id || allChargers[0].id,
        packageId: allChargers[2]?.packages[2]?.id || allChargers[0].packages[2]?.id,
        scheduledStart: addDays(now, -20),
        scheduledEnd: addHours(addDays(now, -20), 2),
        status: 'completed',
        baseAmount: (allChargers[2]?.packages[2]?.price || 340) * 0.93,
        totalAmount: allChargers[2]?.packages[2]?.price || 340,
        platformFee: (allChargers[2]?.packages[2]?.price || 340) * 0.07,
      },
      // Authorized booking - tomorrow (ready to use)
      {
        driverId: driver.id,
        chargerId: allChargers[0].id,
        packageId: allChargers[0].packages[1]?.id,
        scheduledStart: addHours(addDays(now, 1), 10), // Tomorrow at 10am
        scheduledEnd: addHours(addDays(now, 1), 11),
        status: 'authorized',
        baseAmount: (allChargers[0].packages[1]?.price || 140) * 0.93,
        totalAmount: allChargers[0].packages[1]?.price || 140,
        platformFee: (allChargers[0].packages[1]?.price || 140) * 0.07,
      },
      // Authorized booking - in 3 days
      {
        driverId: driver.id,
        chargerId: allChargers[3]?.id || allChargers[0].id,
        packageId: allChargers[3]?.packages[1]?.id || allChargers[0].packages[1]?.id,
        scheduledStart: addHours(addDays(now, 3), 14), // 3 days from now at 2pm
        scheduledEnd: addHours(addDays(now, 3), 15),
        status: 'authorized',
        baseAmount: (allChargers[3]?.packages[1]?.price || 400) * 0.93,
        totalAmount: allChargers[3]?.packages[1]?.price || 400,
        platformFee: (allChargers[3]?.packages[1]?.price || 400) * 0.07,
      },
      // Cancelled booking - was for yesterday
      {
        driverId: driver.id,
        chargerId: allChargers[1]?.id || allChargers[0].id,
        packageId: allChargers[1]?.packages[1]?.id || allChargers[0].packages[1]?.id,
        scheduledStart: addDays(now, -1),
        scheduledEnd: addHours(addDays(now, -1), 1),
        status: 'cancelled',
        baseAmount: (allChargers[1]?.packages[1]?.price || 280) * 0.93,
        totalAmount: allChargers[1]?.packages[1]?.price || 280,
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
        baseAmount: 500 * 0.93,
        totalAmount: 500,
        platformFee: 500 * 0.07,
      },
      {
        driverId: driver.id,
        chargerId: allChargers[1]?.id || allChargers[0].id,
        packageId: allChargers[1]?.packages[0]?.id || allChargers[0].packages[0]?.id,
        scheduledStart: addDays(now, -40),
        scheduledEnd: addHours(addDays(now, -40), 1),
        status: 'completed',
        baseAmount: 200 * 0.93,
        totalAmount: 200,
        platformFee: 200 * 0.07,
      },
      {
        driverId: driver.id,
        chargerId: allChargers[2]?.id || allChargers[0].id,
        packageId: allChargers[2]?.packages[1]?.id || allChargers[0].packages[1]?.id,
        scheduledStart: addDays(now, -45),
        scheduledEnd: addHours(addDays(now, -45), 1),
        status: 'completed',
        baseAmount: 350 * 0.93,
        totalAmount: 350,
        platformFee: 350 * 0.07,
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
              where: { id: driver.id, walletBalance: { gte: total + (parseFloat(process.env.WALLET_DEPOSIT || '250')) } },
              data: { walletBalance: { decrement: total }, walletHeld: { increment: total } },
            });
            if (held.count === 0) {
              console.warn(`⚠️  Skipped an upcoming booking of ${total}: the demo driver's wallet cannot hold it`);
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
                currency: 'INR',
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
                currency: 'INR',
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

Demo Accounts (Password: REDACTED_PASSWORD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Client:      demo_driver@example.com
Host:        demo_host@example.com
Client+Host: clientdemo_host@example.com
Admin:       demo_admin@example.com
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
