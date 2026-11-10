import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate chargers...\n');

  // Get all chargers grouped by hostId, name, address
  const chargers = await prisma.charger.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${chargers.length} total chargers\n`);

  // Group by unique key (hostId + name + address)
  const groups = {};
  for (const charger of chargers) {
    const key = `${charger.hostId}-${charger.name}-${charger.address}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(charger);
  }

  console.log(`Found ${Object.keys(groups).length} unique charger combinations\n`);

  // Find duplicates and delete all but the first (oldest) one
  let deletedCount = 0;
  for (const [key, group] of Object.entries(groups)) {
    if (group.length > 1) {
      console.log(`📍 "${group[0].name}" at "${group[0].address}" has ${group.length} duplicates`);
      
      // Keep the first one (oldest), delete the rest
      const toDelete = group.slice(1);
      for (const charger of toDelete) {
        // First delete any related bookings
        const deletedBookings = await prisma.booking.deleteMany({
          where: { chargerId: charger.id }
        });
        if (deletedBookings.count > 0) {
          console.log(`   Deleted ${deletedBookings.count} related bookings`);
        }

        // Now delete the charger
        await prisma.charger.delete({
          where: { id: charger.id }
        });
        deletedCount++;
        console.log(`   ❌ Deleted duplicate: ${charger.id}`);
      }
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} duplicate chargers.`);

  // Show remaining chargers
  const remaining = await prisma.charger.findMany({
    select: { id: true, name: true, address: true }
  });
  console.log(`\n📋 Remaining ${remaining.length} unique chargers:`);
  remaining.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} - ${c.address}`);
  });
}

cleanupDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
