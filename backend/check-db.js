import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('\n📊 CHARGENEST DATABASE OVERVIEW');
  console.log('='.repeat(60));
  console.log('External DB: Render PostgreSQL\n');
  
  // Get counts for all tables
  const counts = {};
  const models = ['user', 'charger', 'booking', 'payment', 'session', 'review', 'dispute', 'agent', 'mandate', 'auditLog', 'package', 'amenity'];
  
  console.log('TABLE ROW COUNTS:');
  console.log('-'.repeat(40));
  
  for (const model of models) {
    try {
      counts[model] = await prisma[model].count();
      console.log(`  ${model.padEnd(15)} : ${counts[model]}`);
    } catch (e) {
      console.log(`  ${model.padEnd(15)} : (table empty or error)`);
    }
  }
  
  // Show users
  console.log('\n\n👥 USERS');
  console.log('-'.repeat(60));
  try {
    const users = await prisma.user.findMany({
      select: { name: true, email: true, roles: true }
    });
    if (users.length === 0) {
      console.log('  (No users found)');
    } else {
      users.forEach(u => {
        console.log(`  ${u.email.padEnd(30)} | ${u.roles.join(', ').padEnd(15)} | ${u.name}`);
      });
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Show chargers
  console.log('\n\n⚡ CHARGERS');
  console.log('-'.repeat(60));
  try {
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
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Show bookings
  console.log('\n\n📅 BOOKINGS');
  console.log('-'.repeat(60));
  try {
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
        console.log(`  ${b.status.padEnd(12)} | $${String(b.totalAmount).padEnd(6)} | ${b.driver.name} → ${b.charger.name.substring(0,20)}`);
      });
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Show payments
  console.log('\n\n💳 PAYMENTS');
  console.log('-'.repeat(60));
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    if (payments.length === 0) {
      console.log('  (No payments found)');
    } else {
      payments.forEach(p => {
        console.log(`  ${p.status.padEnd(12)} | $${String(p.amount).padEnd(8)} | PayPal: ${p.paypalOrderId || 'N/A'}`);
      });
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Revenue stats
  console.log('\n\n💰 REVENUE SUMMARY');
  console.log('-'.repeat(60));
  try {
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'captured' },
      _sum: { amount: true, platformFee: true, hostPayoutAmount: true }
    });
    console.log(`  Total Captured    : $${totalRevenue._sum.amount || 0}`);
    console.log(`  Platform Fees     : $${totalRevenue._sum.platformFee || 0}`);
    console.log(`  Host Payouts      : $${totalRevenue._sum.hostPayoutAmount || 0}`);
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  console.log('\n' + '='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
