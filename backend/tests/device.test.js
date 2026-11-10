import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Device proof, success rules and delayed payout, with an in-memory database.
 * The fake is installed as the global prisma before the services load.
 */
const HOUR = 3600 * 1000;

const db = { users: {}, booking: {}, payment: {}, session: {}, device: null, events: [], ledger: [] };

const apply = (u, data) => {
  for (const [k, op] of Object.entries(data)) {
    if (op && typeof op === 'object' && !(op instanceof Date) && 'increment' in op) u[k] += op.increment;
    else if (op && typeof op === 'object' && !(op instanceof Date) && 'decrement' in op) u[k] -= op.decrement;
    else u[k] = op;
  }
  return u;
};
const fullBooking = () => ({ ...db.booking, charger: { hostId: 'h' }, session: db.session, payment: db.payment });
// db.session = null mimics a booking that has no session row

const fake = {
  device: {
    findUnique: async ({ where }) => {
      if (where.id) return db.device && db.device.id === where.id ? db.device : null;
      return db.device && db.device.chargerId === where.chargerId ? db.device : null;
    },
    update: async ({ data }) => apply(db.device, data),
    create: async ({ data }) => { db.device = { id: 'dev1', status: 'active', ...data }; return db.device; },
  },
  deviceEvent: {
    findFirst: async () => db.events.reduce((m, e) => (!m || e.counter > m.counter ? e : m), null),
    create: async ({ data }) => { db.events.push({ ...data, createdAt: new Date() }); return data; },
    findMany: async () => [...db.events].sort((a, b) => a.counter - b.counter),
  },
  booking: {
    findUnique: async () => fullBooking(),
    findMany: async ({ where }) => (
      where.status.in.includes(db.booking.status) && db.booking.scheduledEnd < where.scheduledEnd.lt ? [fullBooking()] : []
    ),
    updateMany: async ({ where, data }) => {
      const ok = where.status.in ? where.status.in.includes(db.booking.status) : where.status === db.booking.status;
      if (!ok) return { count: 0 };
      Object.assign(db.booking, data);
      return { count: 1 };
    },
    update: async ({ data }) => Object.assign(db.booking, data),
  },
  session: {
    update: async ({ data }) => Object.assign(db.session, data),
    findUnique: async () => db.session,
    create: async ({ data }) => { db.session = { id: 's-new', proofSource: 'manual', ...data }; return db.session; },
  },
  payment: {
    update: async ({ data }) => Object.assign(db.payment, data),
    updateMany: async ({ where, data }) => {
      if (where.releasedAt === null && db.payment.releasedAt) return { count: 0 };
      Object.assign(db.payment, data);
      return { count: 1 };
    },
    findMany: async ({ where }) => (
      !db.payment.releasedAt && db.payment.releaseAfter && db.payment.releaseAfter <= where.releaseAfter.lte
        && db.booking.status !== 'disputed' && ['captured', 'partially_refunded'].includes(db.payment.status)
        ? [{ ...db.payment, booking: { id: 'b1', charger: { hostId: 'h' } } }] : []
    ),
  },
  charger: { update: async () => ({}) },
  user: {
    findUnique: async ({ where }) => ({ ...db.users[where.id] }),
    update: async ({ where, data }) => apply(db.users[where.id], data),
  },
  walletTransaction: {
    create: async ({ data }) => { db.ledger.push(data); return data; },
    findFirst: async () => (db.noHold ? null : { id: 'hold-row' }),
  },
  auditLog: { create: async () => ({}) },
  $transaction: async (arg) => (typeof arg === 'function' ? arg(fake) : Promise.all(arg)),
};
globalThis.prisma = fake;

const { config } = await import('../src/config/index.js');
const { evaluateSession } = await import('../src/services/session.service.js');
const { deviceService, signEvent } = await import('../src/services/device.service.js');

const SECRET = 'device-secret';

function reset({ delayHours = 0, bookingStatus = 'authorized' } = {}) {
  config.payout.delayHours = delayHours;
  db.users = { d: { walletBalance: 900, walletHeld: 100 }, h: { walletBalance: 500, walletHeld: 0 } };
  db.booking = {
    id: 'b1', driverId: 'd', chargerId: 'c1', status: bookingStatus, totalAmount: 100, currency: 'INR',
    scheduledStart: new Date(Date.now() - 5 * 60000), scheduledEnd: new Date(Date.now() + 55 * 60000),
  };
  db.payment = { id: 'p1', bookingId: 'b1', fundingSource: 'wallet', status: 'authorized' };
  db.session = { id: 's1', bookingId: 'b1', status: 'awaiting_start', proofSource: 'manual' };
  db.device = { id: 'dev1', chargerId: 'c1', secret: SECRET, status: 'active' };
  db.events = [];
  db.ledger = [];
  db.noHold = false;
}

let counter = 0;
async function send(type, payload = {}, overrides = {}) {
  counter += 1;
  const event = { deviceId: 'dev1', bookingId: 'b1', type, counter, ts: Date.now(), payload, ...overrides };
  event.signature = signEvent(overrides.secret || SECRET, event);
  delete event.secret;
  return deviceService.handleEvent(event);
}

// ---------- evaluateSession (pure) ----------

const booking = { totalAmount: 100, scheduledStart: new Date('2026-01-01T10:00:00Z'), scheduledEnd: new Date('2026-01-01T11:00:00Z') };
const at = (min) => new Date(new Date('2026-01-01T10:00:00Z').getTime() + min * 60000);
const unlocked = { type: 'unlocked', payload: {}, createdAt: at(1) };
const ended = (durationMin, energyKwh) => ({ type: 'ended', payload: { durationMin, energyKwh }, createdAt: at(61) });

test('manual proof is a success for the full booked amount', () => {
  assert.deepEqual(evaluateSession({ proofSource: 'manual', booking }), { outcome: 'success', amount: 100 });
});

test('device: nothing yet is pending, and a missed window with no unlock is a no_unlock failure', () => {
  assert.equal(evaluateSession({ proofSource: 'device', booking, events: [], now: at(30) }).outcome, 'pending');
  const late = evaluateSession({ proofSource: 'device', booking, events: [], now: at(60 + 11) });
  assert.deepEqual([late.outcome, late.reason], ['failed', 'no_unlock']);
});

test('device: a full metered session is paid in full', () => {
  const r = evaluateSession({ proofSource: 'device', booking, events: [unlocked, ended(60, 7)], now: at(62) });
  assert.deepEqual([r.outcome, r.amount, r.durationMin], ['success', 100, 60]);
});

test('device: a shorter session is paid for the time used', () => {
  const r = evaluateSession({ proofSource: 'device', booking, events: [unlocked, ended(30, 3.5)], now: at(40) });
  assert.deepEqual([r.outcome, r.amount], ['success', 50]);
});

test('device: under the minimum time fails, and a zero meter fails', () => {
  assert.equal(evaluateSession({ proofSource: 'device', booking, events: [unlocked, ended(1, 0.1)], now: at(5) }).reason, 'too_short');
  assert.equal(evaluateSession({ proofSource: 'device', booking, events: [unlocked, ended(60, 0)], now: at(62) }).reason, 'meter_anomaly');
});

test('device: no meter reading is allowed (time-based device)', () => {
  const r = evaluateSession({ proofSource: 'device', booking, events: [unlocked, ended(60)], now: at(62) });
  assert.equal(r.outcome, 'success');
});

test('device: never ended before the window closes is pending, afterwards it closes at the booked end', () => {
  assert.equal(evaluateSession({ proofSource: 'device', booking, events: [unlocked], now: at(30) }).outcome, 'pending');
  const r = evaluateSession({ proofSource: 'device', booking, events: [unlocked, { type: 'meter', payload: { kwh: 3 }, createdAt: at(30) }], now: at(75) });
  assert.deepEqual([r.outcome, r.durationMin], ['success', 59]);
});

// ---------- signed events ----------

test('an event with a wrong signature, an unknown device or a replayed counter is rejected', async () => {
  reset();
  await assert.rejects(() => send('unlocked', {}, { deviceId: 'nope' }), (e) => e.code === 'DEVICE_UNKNOWN');
  await assert.rejects(() => send('unlocked', {}, { secret: 'wrong-key' }), (e) => e.code === 'DEVICE_BAD_SIGNATURE');

  await send('unlocked');
  const replay = { deviceId: 'dev1', bookingId: 'b1', type: 'meter', counter, ts: Date.now(), payload: { kwh: 1 } };
  replay.signature = signEvent(SECRET, replay);
  await assert.rejects(() => deviceService.handleEvent(replay), (e) => e.code === 'DEVICE_REPLAY');
});

test('a device cannot report on a booking of another charger', async () => {
  reset();
  db.booking.chargerId = 'other';
  await assert.rejects(() => send('unlocked'), /does not belong/);
});

// ---------- full lifecycle with money ----------

test('success: unlocked then ended pays the host minus the 7% fee, now', async () => {
  reset();
  await send('unlocked');
  assert.equal(db.booking.status, 'in_progress');
  assert.equal(db.session.proofSource, 'device');
  const r = await send('ended', { durationMin: 60, energyKwh: 7 });
  assert.equal(r.outcome, 'success');
  assert.equal(db.booking.status, 'completed');
  assert.equal(db.users.d.walletHeld, 0);
  assert.equal(db.users.d.walletBalance, 900);
  assert.equal(db.users.h.walletBalance, 593);
  assert.equal(db.session.outcome, 'success');
});

test('a booking with no session row still works: the session is created on unlock', async () => {
  reset();
  db.session = null;
  await send('unlocked');
  const r = await send('ended', { durationMin: 60, energyKwh: 7 });
  assert.equal(r.outcome, 'success');
  assert.equal(db.session.outcome, 'success');
  assert.equal(db.users.h.walletBalance, 593);
});

test('a booking with no wallet hold is refused at unlock, and no money moves', async () => {
  reset();
  db.noHold = true;
  await assert.rejects(() => send('unlocked'), (e) => e.details?.code === 'NO_WALLET_HOLD' || /no wallet hold/.test(e.message));
  assert.equal(db.booking.status, 'authorized');
  assert.equal(db.users.d.walletHeld, 100);
  assert.equal(db.users.h.walletBalance, 500);
  assert.equal(db.ledger.length, 0);
});

test('success for less time: the unused part goes back to the driver', async () => {
  reset();
  await send('unlocked');
  await send('ended', { durationMin: 30, energyKwh: 3.5 });
  // booked 60 minutes, used 30: driver pays 50 and gets 50 back; host gets 50 - 7% = 46.5
  assert.equal(db.users.d.walletBalance, 950);
  assert.equal(db.users.d.walletHeld, 0);
  assert.equal(db.users.h.walletBalance, 546.5);
  assert.ok(db.ledger.some((l) => l.type === 'refund' && l.amount === 50));
});

test('failure: a zero meter refunds the whole hold and credits the host nothing', async () => {
  reset();
  await send('unlocked');
  const r = await send('ended', { durationMin: 60, energyKwh: 0 });
  assert.deepEqual([r.outcome, r.reason], ['failed', 'meter_anomaly']);
  assert.equal(db.booking.status, 'cancelled');
  assert.equal(db.users.d.walletBalance, 1000);
  assert.equal(db.users.d.walletHeld, 0);
  assert.equal(db.users.h.walletBalance, 500);
  assert.equal(db.payment.status, 'voided');
});

test('a device that never unlocks: the sweep refunds the driver after the window', async () => {
  reset();
  const later = new Date(db.booking.scheduledEnd.getTime() + 11 * 60000);
  const r = await deviceService.sweep({ now: later });
  assert.equal(r.closed, 1);
  assert.equal(db.booking.status, 'cancelled');
  assert.equal(db.session.outcome, 'failed:no_unlock');
  assert.equal(db.users.d.walletBalance, 1000);
});

test('the sweep leaves a booking alone while its window is still open', async () => {
  reset();
  const r = await deviceService.sweep({ now: new Date() });
  assert.equal(r.closed, 0);
  assert.equal(db.booking.status, 'authorized');
});

// ---------- delayed payout ----------

test('with a payout delay the host is credited only after the delay passes', async () => {
  reset({ delayHours: 24 });
  await send('unlocked');
  await send('ended', { durationMin: 60, energyKwh: 7 });
  assert.equal(db.users.h.walletBalance, 500, 'host not credited yet');
  assert.equal(db.users.d.walletHeld, 0, 'driver escrow is already cleared');
  assert.ok(db.payment.releaseAfter > new Date());

  assert.deepEqual(await deviceService.sweep({ now: new Date(Date.now() + 1 * HOUR) }), { closed: 0, paid: 0 });
  assert.equal(db.users.h.walletBalance, 500);

  const r = await deviceService.sweep({ now: new Date(Date.now() + 25 * HOUR) });
  assert.equal(r.paid, 1);
  assert.equal(db.users.h.walletBalance, 593);
  assert.ok(db.payment.releasedAt);

  // running it again pays nothing twice
  assert.equal((await deviceService.sweep({ now: new Date(Date.now() + 26 * HOUR) })).paid, 0);
  assert.equal(db.users.h.walletBalance, 593);
});

test('a dispute during the delay freezes the payout', async () => {
  reset({ delayHours: 24 });
  await send('unlocked');
  await send('ended', { durationMin: 60, energyKwh: 7 });
  db.booking.status = 'disputed';
  const r = await deviceService.sweep({ now: new Date(Date.now() + 25 * HOUR) });
  assert.equal(r.paid, 0);
  assert.equal(db.users.h.walletBalance, 500);
});

test.after(() => { config.payout.delayHours = 0; });
