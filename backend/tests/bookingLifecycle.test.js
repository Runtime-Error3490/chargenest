import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Booking lifecycle with an in-memory database and a stubbed PayPal client.
 * The fake is installed as the global prisma before the services load.
 */
function makeDb() {
  const db = {
    users: {
      d: { walletBalance: 1000, walletHeld: 0 },
      h: { walletBalance: 500, walletHeld: 0 },
    },
    booking: {
      id: 'b1', driverId: 'd', chargerId: 'c1', status: 'authorized', totalAmount: 100,
      currency: 'INR', scheduledStart: new Date(Date.now() + 72 * 3600 * 1000),
    },
    payment: { id: 'p1', bookingId: 'b1', fundingSource: 'wallet', status: 'authorized', paypalAuthId: null },
    ledger: [],
  };
  const apply = (u, data) => {
    for (const [k, op] of Object.entries(data)) {
      if (op && typeof op === 'object' && 'increment' in op) u[k] += op.increment;
      else if (op && typeof op === 'object' && 'decrement' in op) u[k] -= op.decrement;
      else u[k] = op;
    }
  };
  const fake = {
    booking: {
      findUnique: async () => ({ ...db.booking, payment: { ...db.payment } }),
      updateMany: async ({ where, data }) => {
        const ok = where.status.in ? where.status.in.includes(db.booking.status) : where.status === db.booking.status;
        if (!ok) return { count: 0 };
        Object.assign(db.booking, data);
        return { count: 1 };
      },
      update: async ({ data }) => Object.assign(db.booking, data),
    },
    payment: { update: async ({ data }) => Object.assign(db.payment, data) },
    charger: {
      findUnique: async () => ({ hostId: 'h' }),
      update: async () => ({}),
    },
    session: { update: async () => ({}), updateMany: async () => ({ count: 1 }) },
    user: {
      findUnique: async ({ where }) => ({ ...db.users[where.id] }),
      update: async ({ where, data }) => { apply(db.users[where.id], data); return db.users[where.id]; },
    },
    walletTransaction: {
      create: async ({ data }) => { db.ledger.push(data); return data; },
      // Every booking in these tests was held when it was made
      findFirst: async () => ({ id: 'hold-row' }),
    },
    $transaction: async (arg) => (typeof arg === 'function' ? arg(fake) : Promise.all(arg)),
  };
  return { db, fake };
}

const { db, fake } = makeDb();
globalThis.prisma = fake;

const { bookingService } = await import('../src/services/booking.service.js');
const { sessionService } = await import('../src/services/session.service.js');
const { paypalService } = await import('../src/services/paypal.service.js');

function reset(overrides = {}) {
  db.users.d = { walletBalance: 900, walletHeld: 100 };
  db.users.h = { walletBalance: 500, walletHeld: 0 };
  db.booking = {
    id: 'b1', driverId: 'd', chargerId: 'c1', status: 'authorized', totalAmount: 100,
    currency: 'INR', scheduledStart: new Date(Date.now() + 72 * 3600 * 1000), ...overrides.booking,
  };
  db.payment = { id: 'p1', bookingId: 'b1', fundingSource: 'wallet', status: 'authorized', paypalAuthId: null, ...overrides.payment };
  db.ledger.length = 0;
}

test('cancel with no fee returns the whole hold, and a second cancel moves nothing', async () => {
  reset();
  const first = await bookingService.cancelBooking('b1', 'd', 'changed my mind');
  assert.equal(first.status, 'cancelled');
  assert.equal(db.users.d.walletBalance, 1000);
  assert.equal(db.users.d.walletHeld, 0);
  const rows = db.ledger.length;

  const second = await bookingService.cancelBooking('b1', 'd', 'again');
  assert.equal(second.alreadyCancelled, true);
  assert.equal(db.users.d.walletBalance, 1000);
  assert.equal(db.ledger.length, rows);
});

test('failBooking voids the hold once and is safe to repeat', async () => {
  reset();
  const first = await bookingService.failBooking('b1', 'charger offline');
  assert.equal(first.alreadyCancelled, false);
  assert.equal(first.refundAmount, 100);
  assert.equal(db.users.d.walletBalance, 1000);
  assert.equal(db.users.d.walletHeld, 0);
  assert.equal(db.payment.status, 'voided');

  const second = await bookingService.failBooking('b1', 'charger offline');
  assert.equal(second.alreadyCancelled, true);
  assert.equal(db.users.d.walletBalance, 1000);
});

test('failBooking refuses a booking that already completed', async () => {
  reset({ booking: { status: 'completed' } });
  await assert.rejects(() => bookingService.failBooking('b1'), /Cannot fail booking/);
});

test('PayPal failBooking voids the authorization and restores the booking on PayPal error', async () => {
  reset({ payment: { fundingSource: 'paypal', paypalAuthId: 'AUTH1' } });
  const original = paypalService.voidAuthorization;
  let calls = 0;
  paypalService.voidAuthorization = async () => { calls += 1; throw new Error('paypal down'); };
  await assert.rejects(() => bookingService.failBooking('b1'), /paypal down/);
  assert.equal(db.booking.status, 'authorized'); // reopened, can be retried

  paypalService.voidAuthorization = async () => { calls += 1; };
  await bookingService.failBooking('b1');
  await bookingService.failBooking('b1');
  assert.equal(calls, 2); // one failed try, one success, repeat did nothing
  assert.equal(db.booking.status, 'cancelled');
  paypalService.voidAuthorization = original;
});

test('ending a session pays the host once; a second end releases nothing', async () => {
  reset({ booking: { status: 'in_progress' } });
  const full = {
    ...db.booking,
    chargerId: 'c1',
    charger: { hostId: 'h', host: { paypalEmail: null } },
    session: { id: 's1', status: 'in_progress', actualStart: new Date(Date.now() - 3600 * 1000) },
  };
  fake.booking.findUnique = async () => ({
    ...full, ...db.booking, payment: { ...db.payment },
  });

  await sessionService.endSession('b1', 'd', 'driver');
  const hostAfter = db.users.h.walletBalance;
  assert.equal(hostAfter, 500 + 93); // 100 minus 7 percent fee
  assert.equal(db.users.d.walletHeld, 0);

  const again = await sessionService.endSession('b1', 'd', 'driver');
  assert.equal(again.alreadyCompleted, true);
  assert.equal(db.users.h.walletBalance, hostAfter);
});
