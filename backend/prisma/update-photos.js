import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// High-quality EV charging stock photos from Unsplash (free to use)
// Using direct Unsplash URLs with auto=format for better compatibility
const stockPhotos = {
  homeCharger: [
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=800&q=80',
  ],
  cafeCharger: [
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80',
  ],
  apartmentCharger: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=800&q=80',
  ],
  techParkCharger: [
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
  ],
  residentialCharger: [
    'https://images.unsplash.com/photo-1647166545674-ce28ce93bdca?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
  ],
  mallCharger: [
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1619317565003-5c85e5f0a4a8?auto=format&fit=crop&w=800&q=80',
  ],
  hotelCharger: [
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
  ],
};

// Map charger names to photo sets
const chargerPhotoMap = {
  "Sarah's Home Charger": stockPhotos.homeCharger,
  "Priya's Home Charger": stockPhotos.homeCharger,
  "Quick Charge @ Brew House": stockPhotos.cafeCharger,
  "Quick Charge Koramangala": stockPhotos.cafeCharger,
  "Skyline Apartments Charger": stockPhotos.apartmentCharger,
  "Indiranagar Apartment Charger": stockPhotos.apartmentCharger,
  "TechHub Fast Charger": stockPhotos.techParkCharger,
  "Whitefield Tech Park": stockPhotos.techParkCharger,
  "Peaceful Gardens Charger": stockPhotos.residentialCharger,
  "JP Nagar Home Charger": stockPhotos.residentialCharger,
  "Phoenix Mall Charger": stockPhotos.mallCharger,
  "Grand Hotel Charger": stockPhotos.hotelCharger,
};

async function main() {
  console.log('🖼️  Updating charger photos...');

  const chargers = await prisma.charger.findMany();
  
  for (const charger of chargers) {
    const photos = chargerPhotoMap[charger.name];
    if (photos) {
      await prisma.charger.update({
        where: { id: charger.id },
        data: { photos },
      });
      console.log(`  ✅ Updated photos for: ${charger.name}`);
    } else {
      // Default photos for any unmatched charger
      await prisma.charger.update({
        where: { id: charger.id },
        data: { photos: stockPhotos.homeCharger },
      });
      console.log(`  ✅ Added default photos for: ${charger.name}`);
    }
  }

  console.log(`\n🎉 Updated photos for ${chargers.length} chargers!`);
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
