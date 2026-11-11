const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n📊 CHARGENEST DATABASE OVERVIEW');
  console.log('='.repeat(60));
  console.log('External DB: Render PostgreSQL\n');
  
  // Get counts for all tables
  console.log('TABLE ROW COUNTS:');
  console.log('-'.repeat(40));
  
  const models = ['user', 'charger', 'booking', 'payment', 'session', 'dispute', 'agent', 'mandate', 'auditLog', 'walletTransaction'];
  
  for (const model of models) {
    try {
      const count = await prisma[model].count();
      console.log(`  ${model.padEnd(20)} : ${count}`);
    } catch (e) {
      console.log(`  ${model.padEnd(20)} : error - ${e.message.substring(0,50)}`);
    }
  }
  
  // Show users with wallet info
  console.log('\n\n👥 USERS (with Wallet Balance)');
  console.log('-'.repeat(70));
  const users = await prisma.user.findMany({
    select: { name: true, email: true, roles: true, walletBalance: true, walletHeld: true }
  });
  if (users.length === 0) {
    console.log('  (No users found)');
  } else {
    console.log('  Email                          | Wallet    | Held      | Name');
    console.log('  ' + '-'.repeat(66));
    users.forEach(u => {
      const balance = parseFloat(u.walletBalance || 0).toFixed(2);
      const held = parseFloat(u.walletHeld || 0).toFixed(2);
      console.log(`  ${u.email.padEnd(30)} | ₹${balance.padStart(7)} | ₹${held.padStart(7)} | ${u.name}`);
    });
  }
  
  // Show chargers
  console.log('\n\n⚡ CHARGERS');
  console.log('-'.repeat(60));
  const chargers = await prisma.charger.findMany({
    include: { host: { select: { name: true } } }
  });
  if (chargers.length === 0) {
    console.log('  (No chargers found)');
  } else {
    chargers.forEach(c => {
      console.log(`  ${c.name.substring(0,30).padEnd(30)} | ${c.status.padEnd(10)} | Host: ${c.host.name}`);
    });
  }
  
  // Show bookings
  console.log('\n\n📅 BOOKINGS');
  console.log('-'.repeat(60));
  const bookings = await prisma.booking.findMany({
    include: { 
      driver: { select: { name: true } },
      charger: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  if (bookings.length === 0) {
    console.log('  (No bookings found)');
  } else {
    bookings.forEach(b => {
      console.log(`  ${b.status.padEnd(12)} | ₹${String(b.totalAmount).padEnd(6)} | ${b.driver.name} → ${b.charger.name.substring(0,20)}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
