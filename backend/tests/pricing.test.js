import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Prices come from the host's hourly rate, not from fixed packages.
 */
const created = [];
globalThis.prisma = {
  timePackage: {
    create: async ({ data }) => { const row = { id: `pkg-${created.length + 1}`, ...data }; created.push(row); return row; },
  },
};

const { hourlyRateOf, priceForDuration } = await import('../src/services/charger.service.js');
const { bookingService } = await import('../src/services/booking.service.js');

const pkg = (durationMin, price, extra = {}) => ({ id: `p${durationMin}`, durationMin, price, currency: 'USD', isActive: true, ...extra });

test('the hourly rate is the price of the 1 hour package', () => {
  assert.equal(hourlyRateOf([pkg(30, 95), pkg(60, 180), pkg(120, 340)]), 180);
});

test('without a 1 hour package the cheapest rate per hour is used; none means no rate', () => {
  assert.equal(hourlyRateOf([pkg(30, 100), pkg(240, 280)]), 70);
  assert.equal(hourlyRateOf([]), null);
  assert.equal(hourlyRateOf([pkg(60, 100, { isActive: false })]), null);
});

test('price is the hourly rate times the time, rounded to 2 decimals', () => {
  assert.equal(priceForDuration(180, 30), 90);
  assert.equal(priceForDuration(180, 90), 270);
  assert.equal(priceForDuration(100, 45), 75);
  assert.equal(priceForDuration(45, 15), 11.25);
  assert.equal(priceForDuration(80, 20), 26.67);
});

test('a booking duration gets a package priced from the host rate', async () => {
  created.length = 0;
  const charger = { id: 'c1', packages: [pkg(60, 180)] };
  const made = await bookingService.packageForDuration(charger, 120);
  assert.deepEqual([made.durationMin, made.price, made.name, made.currency], [120, 360, '2 Hours', 'USD']);
  assert.equal(created.length, 1);
});

test('an existing package with the same length and price is reused', async () => {
  created.length = 0;
  const charger = { id: 'c1', packages: [pkg(60, 180), pkg(120, 360)] };
  const made = await bookingService.packageForDuration(charger, 120);
  assert.equal(made.id, 'p120');
  assert.equal(created.length, 0);
});

test('an old package with a stale price is not reused: the new price gets its own package', async () => {
  created.length = 0;
  const charger = { id: 'c1', packages: [pkg(60, 200), pkg(120, 340)] };
  const made = await bookingService.packageForDuration(charger, 120);
  assert.equal(made.price, 400);
  assert.equal(created.length, 1);
});

test('durations outside 15 to 480 minutes or not in steps of 15 are refused', async () => {
  const charger = { id: 'c1', packages: [pkg(60, 180)] };
  for (const bad of [0, 10, 20, 500, 61, 'x', undefined, 7.5]) {
    await assert.rejects(() => bookingService.packageForDuration(charger, bad), /Choose a duration/);
  }
});

test('a charger with no rate cannot be booked by duration', async () => {
  await assert.rejects(() => bookingService.packageForDuration({ id: 'c1', packages: [] }, 60), /no hourly rate/);
});
