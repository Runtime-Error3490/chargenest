import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Wallet gate, booking hold, invoice and dispute with an in-memory database
 * and a stubbed PayPal client. The fake is installed as the global prisma first.
 */
const db = {};
const apply = (u, data) => {
  for (const [k, op] of Object.entries(data)) {
    if (op && typeof op === 'object' && 'increment' in op) u[k] += op.increment;
    else if (op && typeof op === 'object' && 'decrement' in op) u[k] -= op.decrement;
    else u[k] = op;
  }
};

const fake = {
  user: {
    findUnique: async ({ where }) => db.users[where.id] && { ...db.users[where.id] },
    update: async ({ where, data }) => { apply(db.users[where.id], data); return db.users[where.id]; },
    updateMany: async ({ where, data }) => {
      const u = db.users[where.id];
      if (u && u.walletBalance >= where.walletBalance.gte) { apply(u, data); return { count: 1 }; }
      return { count: 0 };
    },
  },
  walletTransaction: { create: async ({ data }) => { db.ledger.push(data); return data; } },
  charger: {
    findUnique: async () => db.charger,
    create: async () => { db.chargerCreated = true; return {}; },
  },
  booking: {
    findFirst: async () => null,
    findUnique: async () => db.bookingRow,
    create: async ({ data }) => {
      db.created = { id: 'b9', charger: { name: 'C', address: 'A' }, package: { name: 'P', durationMin: 60 }, ...data };
      return db.created;
    },
    update: async ({ data }) => { Object.assign(db.bookingRow, data); return db.bookingRow; },
  },
  payment: {
    create: async ({ data }) => { db.payment = data; return data; },
    aggregate: async () => ({ _sum: { hostPayoutAmount: null } }),
  },
  session: { create: async ({ data }) => { db.session = data; return data; } },
  invoice: {
    create: async ({ data }) => { db.invoice = { id: 'i1', createdAt: new Date(), ...data }; return db.invoice; },
    update: async ({ data }) => Object.assign(db.invoice, data),
  },
  dispute: {
    create: async ({ data }) => { db.dispute = { id: 'dp1', ...data }; return db.dispute; },
  },
  $transaction: async (arg) => (typeof arg === 'function' ? arg(fake) : Promise.all(arg)),
};
globalThis.prisma = fake;

const { bookingService } = await import('../src/services/booking.service.js');
const { chargerService } = await import('../src/services/charger.service.js');
const { invoiceService } = await import('../src/services/invoice.service.js');
const { disputeService } = await import('../src/services/dispute.service.js');
const { paypalService } = await import('../src/services/paypal.service.js');
const { walletService } = await import('../src/services/wallet.service.js');

// WALLET_MIN_BALANCE is 500 and the platform fee 7 percent (tests/setup.js)
function reset(balance = 1000) {
  db.users = { d: { walletBalance: balance, walletHeld: 0 }, h: { walletBalance: 0, walletHeld: 0 } };
  db.ledger = [];
  db.chargerCreated = false;
  db.created = null;
  db.payment = null;
  db.session = null;
  db.invoice = null;
  db.dispute = null;
  db.charger = {
    id: 'c1', name: 'Charger', status: 'active', hostId: 'h',
    packages: [{ id: 'p1', name: 'One hour', durationMin: 60, price: 100, currency: 'USD' }],
    host: { paypalEmail: null },
  };
}

const bookingInput = () => ({
  driverId: 'd', chargerId: 'c1', packageId: 'p1',
  scheduledStart: new Date(Date.now() + 3600 * 1000).toISOString(),
});

test('booking is blocked below the minimum balance and nothing is written', async () => {
  reset(499);
  await assert.rejects(() => bookingService.createBooking(bookingInput()), /damage deposit/);
  assert.equal(db.created, null);
  assert.equal(db.users.d.walletHeld, 0);
});

test('listing a charger is blocked below the minimum balance', async () => {
  reset(100);
  await assert.rejects(() => chargerService.createCharger('d', { name: 'X' }), /list a charger/);
  assert.equal(db.chargerCreated, false);
});

test('booking holds the total from the driver wallet and keeps the deposit', async () => {
  reset(1000);
  const res = await bookingService.createBooking(bookingInput());
  assert.equal(res.booking.status, 'authorized');
  assert.equal(res.booking.totalAmount, 107); // 100 plus 7 percent fee
  assert.equal(db.users.d.walletBalance, 893);
  assert.equal(db.users.d.walletHeld, 107);
  assert.equal(db.payment.status, 'authorized');
  assert.equal(db.session.status, 'awaiting_start');
});

test('a hold that would dip into the deposit is refused and leaves no hold', async () => {
  reset(500); // deposit is 250, so 250 is spendable
  db.charger.packages[0].price = 400; // total 428
  await assert.rejects(() => bookingService.createBooking(bookingInput()));
  assert.equal(db.users.d.walletHeld, 0);
  assert.equal(db.users.d.walletBalance, 500);
});

test('invoice is created, sent through PayPal and stored as sent', async () => {
  reset();
  db.bookingRow = {
    id: 'b1', status: 'completed', totalAmount: 100, currency: 'USD',
    charger: { hostId: 'h', name: 'Charger' },
    driver: { id: 'd', email: 'd@test.dev', name: 'Dee' },
  };
  const calls = [];
  const orig = { c: paypalService.createInvoice, s: paypalService.sendInvoice, g: paypalService.getInvoice };
  paypalService.createInvoice = async (a) => { calls.push(['create', a.amount, a.recipientEmail]); return { invoiceId: 'INV1' }; };
  paypalService.sendInvoice = async (id) => { calls.push(['send', id]); };
  paypalService.getInvoice = async () => ({ recipientViewUrl: 'https://paypal.test/pay/INV1' });
  try {
    const out = await invoiceService.createDamageInvoice('h', { bookingId: 'b1', amount: 40, description: 'Scratched cable' });
    assert.deepEqual(calls, [['create', 40, 'd@test.dev'], ['send', 'INV1']]);
    assert.equal(out.status, 'sent');
    assert.equal(out.payUrl, 'https://paypal.test/pay/INV1');
  } finally {
    Object.assign(paypalService, { createInvoice: orig.c, sendInvoice: orig.s, getInvoice: orig.g });
  }
});

test('only the host of the charger can send an invoice, and only after the session', async () => {
  reset();
  db.bookingRow = {
    id: 'b1', status: 'completed', totalAmount: 100, currency: 'USD',
    charger: { hostId: 'h', name: 'Charger' }, driver: { id: 'd', email: 'd@test.dev', name: 'Dee' },
  };
  await assert.rejects(() => invoiceService.createDamageInvoice('d', { bookingId: 'b1', amount: 10, description: 'x' }), /not on your charger/);
  db.bookingRow.status = 'authorized';
  await assert.rejects(() => invoiceService.createDamageInvoice('h', { bookingId: 'b1', amount: 10, description: 'x' }), /session has ended/);
});

test('driver raises a dispute: it is stored and the booking becomes disputed', async () => {
  reset();
  db.bookingRow = {
    id: 'b1', status: 'completed', driverId: 'd', scheduledEnd: new Date(),
    charger: { hostId: 'h' }, session: null, payment: null, dispute: null,
  };
  const original = disputeService.analyzeDispute;
  disputeService.analyzeDispute = async () => ({
    autoResolved: false,
    dispute: { status: 'under_review', aiDecision: null, aiRefundAmount: null, aiReasoning: null, aiConfidence: null },
  });
  try {
    const out = await disputeService.raiseDispute('d', { bookingId: 'b1', reason: 'charger_faulty', description: 'No power' });
    assert.equal(db.dispute.raisedByRole, 'driver');
    assert.equal(db.bookingRow.status, 'disputed');
    assert.equal(out.dispute.status, 'under_review');
  } finally {
    disputeService.analyzeDispute = original;
  }
});

test('a second dispute on the same booking is rejected', async () => {
  reset();
  db.bookingRow = {
    id: 'b1', status: 'completed', driverId: 'd', scheduledEnd: new Date(),
    charger: { hostId: 'h' }, session: null, payment: null, dispute: { id: 'dp0' },
  };
  await assert.rejects(() => disputeService.raiseDispute('d', { bookingId: 'b1', reason: 'x', description: 'y' }), /already has a dispute/);
});

// ---- Closing the wallet ----
function closeSetup({ bookings = 0, disputes = 0, invoices = 0, balance = 250 } = {}) {
  reset(balance);
  db.users.d.paypalEmail = 'd@paypal.test';
  fake.booking.count = async () => bookings;
  fake.dispute.count = async () => disputes;
  fake.invoice.count = async () => invoices;
}

test('closing the wallet pays out everything, deposit included', async () => {
  closeSetup({ balance: 250 });
  const orig = paypalService.createPayout;
  let paid;
  paypalService.createPayout = async (a) => { paid = a.amount; return { payoutBatchId: 'PB1', status: 'SUCCESS' }; };
  try {
    const out = await walletService.closeWallet('d');
    assert.equal(paid, 250);
    assert.equal(out.amount, 250);
    assert.equal(db.users.d.walletBalance, 0);
    assert.equal(db.ledger.at(-1).type, 'withdrawal');
  } finally {
    paypalService.createPayout = orig;
  }
});

test('closing is blocked while a booking, dispute or unpaid invoice is open', async () => {
  for (const open of [{ bookings: 1 }, { disputes: 1 }, { invoices: 1 }]) {
    closeSetup(open);
    await assert.rejects(() => walletService.closeWallet('d'), /Finish your open/);
    assert.equal(db.users.d.walletBalance, 250);
  }
});

test('if PayPal fails, the money goes back to the wallet', async () => {
  closeSetup({ balance: 300 });
  const orig = paypalService.createPayout;
  paypalService.createPayout = async () => { throw new Error('paypal down'); };
  try {
    await assert.rejects(() => walletService.closeWallet('d'), /paypal down/);
    assert.equal(db.users.d.walletBalance, 300);
  } finally {
    paypalService.createPayout = orig;
  }
});

test('a second capture of an applied top-up is not an error and credits nothing', async () => {
  reset(1500);
  const { PaymentError } = await import('../src/utils/errors.js');
  const origCapture = paypalService.captureOrder;
  const origFind = fake.walletTransaction.findUnique;
  const origCount = fake.walletTransaction.count;
  const origMany = fake.walletTransaction.findMany;
  let lookups = 0;
  // First lookup: not yet in the ledger. Second (after PayPal refuses): applied by the other request.
  fake.walletTransaction.findUnique = async () => (lookups++ === 0 ? null : { userId: 'd' });
  fake.walletTransaction.count = async () => 1;
  fake.walletTransaction.findMany = async () => [];
  paypalService.captureOrder = async () => {
    throw new PaymentError('Order already captured', { details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] });
  };
  try {
    const result = await walletService.completeTopUp('d', 'O1');
    assert.equal(result.credited, false);
    assert.equal(db.users.d.walletBalance, 1500);
    assert.equal(db.ledger.length, 0);
  } finally {
    paypalService.captureOrder = origCapture;
    fake.walletTransaction.findUnique = origFind;
    fake.walletTransaction.count = origCount;
    fake.walletTransaction.findMany = origMany;
  }
});
