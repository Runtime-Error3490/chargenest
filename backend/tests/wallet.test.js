import test from 'node:test';
import assert from 'node:assert/strict';
import { walletService, spendableAmount, isDepositMet, round2 } from '../src/services/wallet.service.js';

/**
 * In-memory stand-in for a Prisma transaction client. It supports only what wallet.service uses.
 */
function fakeTx(users) {
  const ledger = [];
  const apply = (user, data) => {
    for (const [field, op] of Object.entries(data)) {
      if (op && typeof op === 'object' && 'increment' in op) user[field] += op.increment;
      else if (op && typeof op === 'object' && 'decrement' in op) user[field] -= op.decrement;
      else user[field] = op;
    }
  };
  return {
    ledger,
    users,
    user: {
      findUnique: async ({ where }) => users[where.id] && { ...users[where.id] },
      update: async ({ where, data }) => { apply(users[where.id], data); return users[where.id]; },
      updateMany: async ({ where, data }) => {
        const u = users[where.id];
        if (u && u.walletBalance >= where.walletBalance.gte) {
          apply(u, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    walletTransaction: {
      create: async ({ data }) => { ledger.push(data); return data; },
    },
  };
}

const wallet = (walletBalance, walletHeld = 0) => ({ walletBalance, walletHeld });

test('only money above the 250 deposit is spendable', () => {
  assert.equal(spendableAmount(500), 250);
  assert.equal(spendableAmount(1200), 950);
  assert.equal(spendableAmount(250), 0);
  assert.equal(spendableAmount(100), 0);
});

test('the wallet is ready at 500 in total, and held booking money still counts', () => {
  assert.equal(isDepositMet(500), true);
  assert.equal(isDepositMet(499.99), false);
  assert.equal(isDepositMet('800.00'), true);
  assert.equal(isDepositMet(300, 200), true); // 300 spendable + deposit, 200 held for a booking
  assert.equal(isDepositMet(250, 100), false);
});

test('rounding keeps two decimals', () => {
  assert.equal(round2(10.005), 10.01);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('hold moves money from balance to escrow and writes a ledger row', async () => {
  const tx = fakeTx({ d: wallet(1500) });
  await walletService.hold(tx, 'd', 400, 'b1');
  assert.equal(tx.users.d.walletBalance, 1100);
  assert.equal(tx.users.d.walletHeld, 400);
  assert.equal(tx.ledger[0].type, 'booking_hold');
  assert.equal(tx.ledger[0].bookingId, 'b1');
  assert.equal(tx.ledger[0].balanceAfter, 1100);
});

test('hold cannot touch the deposit', async () => {
  const tx = fakeTx({ d: wallet(600) });
  await assert.rejects(() => walletService.hold(tx, 'd', 400, 'b1'), /deposit cannot be spent/);
  assert.equal(tx.users.d.walletBalance, 600);
  assert.equal(tx.users.d.walletHeld, 0);
  assert.equal(tx.ledger.length, 0);
});

test('hold works down to exactly the deposit', async () => {
  const tx = fakeTx({ d: wallet(650) });
  await walletService.hold(tx, 'd', 400, 'b1');
  assert.equal(tx.users.d.walletBalance, 250);
});

test('release pays the host the amount after the fee and clears the driver escrow', async () => {
  const tx = fakeTx({ d: wallet(1100, 400), h: wallet(500) });
  await walletService.release(tx, { driverId: 'd', hostId: 'h', heldAmount: 400, hostAmount: 372, bookingId: 'b1' });
  assert.equal(tx.users.d.walletHeld, 0);
  assert.equal(tx.users.d.walletBalance, 1100);
  assert.equal(tx.users.h.walletBalance, 872);
  assert.deepEqual(tx.ledger.map((l) => l.type), ['hold_release', 'host_credit']);
});

test('returning a hold gives the money back to the driver', async () => {
  const tx = fakeTx({ d: wallet(1100, 400) });
  await walletService.returnHold(tx, 'd', 400, 'b1');
  assert.equal(tx.users.d.walletBalance, 1500);
  assert.equal(tx.users.d.walletHeld, 0);
});

test('a dispute refund after release credits the driver and takes the host share from the host', async () => {
  const tx = fakeTx({ d: wallet(1100), h: wallet(872) });
  await walletService.refundAfterRelease(tx, { driverId: 'd', hostId: 'h', amount: 100, bookingId: 'b1' });
  assert.equal(tx.users.d.walletBalance, 1200);
  assert.equal(tx.users.h.walletBalance, 872 - 93); // 100 minus the 7% platform share
});

test('a refund never drives the host balance below zero; the driver is still made whole', async () => {
  const tx = fakeTx({ d: wallet(1100), h: wallet(20) });
  await walletService.refundAfterRelease(tx, { driverId: 'd', hostId: 'h', amount: 100, bookingId: 'b1' });
  assert.equal(tx.users.d.walletBalance, 1200);
  assert.equal(tx.users.h.walletBalance, 0);
});

test('top-up rejects zero or negative amounts before calling PayPal', async () => {
  await assert.rejects(() => walletService.startTopUp('u1', 0), /greater than zero/);
  await assert.rejects(() => walletService.startTopUp('u1', -5), /greater than zero/);
});
