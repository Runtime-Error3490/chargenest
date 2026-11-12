import { prisma } from '../utils/prisma.js';
import { config, getSiteUrl } from '../config/index.js';
import { paypalService } from './paypal.service.js';
import { ValidationError, ForbiddenError, ConflictError } from '../utils/errors.js';

/**
 * PayPal-funded wallet.
 *
 * - Money enters only through a PayPal order that the user approves (top-up).
 * - Money leaves only through a PayPal payout (withdrawal) or stays in the ledger.
 * - A user needs config.wallet.minBalance in the wallet before booking or listing.
 * - walletBalance holds spendable money plus the damage deposit (config.wallet.deposit, a part of
 *   the minimum). The deposit can never be spent on a booking or withdrawn.
 * - walletHeld is escrow for bookings that are not finished yet.
 */

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (d) => (d === null || d === undefined ? 0 : parseFloat(d));

/**
 * Pure rule: how much of a balance can be spent or withdrawn.
 */
export function spendableAmount(balance, deposit = config.wallet.deposit) {
  return Math.max(0, round2(num(balance) - deposit));
}

/**
 * Pure rule: is the wallet funded enough to book or list? Money held for open bookings still counts,
 * so a user is not locked out while a booking is waiting to finish.
 */
export function isDepositMet(balance, held = 0, minBalance = config.wallet.minBalance) {
  return round2(num(balance) + num(held)) >= minBalance;
}

/**
 * Write a ledger row using the user's current balance. Run inside the same transaction as the balance change.
 */
async function writeLedger(tx, userId, type, amount, extra = {}) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
  return tx.walletTransaction.create({
    data: {
      userId,
      type,
      amount: round2(amount),
      balanceAfter: user.walletBalance,
      currency: config.platform.defaultCurrency,
      ...extra,
    },
  });
}

function formatWallet(user) {
  const balance = num(user.walletBalance);
  return {
    balance,
    held: num(user.walletHeld),
    spendable: spendableAmount(balance),
    // Needed to start: minBalance in total (the deposit, by default). `deposit` stays locked; the rest pays for bookings
    minBalance: config.wallet.minBalance,
    deposit: config.wallet.deposit,
    shortfall: Math.max(0, round2(config.wallet.minBalance - balance - num(user.walletHeld))),
    depositMet: isDepositMet(balance, user.walletHeld),
    currency: config.platform.defaultCurrency,
    // True when no PayPal credentials are set and payments are simulated
    paypalMock: paypalService.isMock(),
  };
}

export const walletService = {
  /**
   * Mock mode only: give a never-used wallet a one-time demo credit so there is data to show.
   * Real PayPal mode never does this.
   */
  async grantMockCredit(userId) {
    const amount = config.wallet.mockCredit;
    if (!paypalService.isMock() || !(amount > 0)) return;

    const used = await prisma.walletTransaction.count({ where: { userId } });
    if (used > 0) return;

    await prisma.$transaction(async (tx) => {
      const credited = await tx.user.updateMany({
        where: { id: userId, walletBalance: 0, walletHeld: 0 },
        data: { walletBalance: amount },
      });
      if (credited.count > 0) {
        await writeLedger(tx, userId, 'topup', amount, { note: 'Mock mode demo credit' });
      }
    });
  },

  async getWallet(userId, { limit = 20 } = {}) {
    await this.grantMockCredit(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true, walletHeld: true },
    });
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Earnings waiting for the payout delay to pass
    const pending = await prisma.payment.aggregate({
      where: { releasedAt: null, releaseAfter: { not: null }, status: 'captured', booking: { charger: { hostId: userId } } },
      _sum: { hostPayoutAmount: true },
    });

    return {
      wallet: { ...formatWallet(user), pendingPayout: num(pending._sum.hostPayoutAmount) },
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: num(t.amount),
        balanceAfter: num(t.balanceAfter),
        bookingId: t.bookingId,
        note: t.note,
        createdAt: t.createdAt,
      })),
    };
  },

  /**
   * Gate for booking and listing: the minimum balance must be in the wallet.
   */
  async assertDepositMet(userId, what = 'continue') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true, walletHeld: true } });
    if (!user || !isDepositMet(user.walletBalance, user.walletHeld)) {
      const { minBalance, deposit } = config.wallet;
      const currency = config.platform.defaultCurrency;
      throw new ForbiddenError(
        `Your wallet needs at least ${minBalance} ${currency} before you ${what}. ${deposit} ${currency} of it stays as a damage deposit${minBalance > deposit ? ` and the other ${round2(minBalance - deposit)} ${currency} is yours to spend` : ''}. Money above the deposit pays for bookings, so add enough to cover them.`,
        { code: 'DEPOSIT_REQUIRED', minBalance, deposit }
      );
    }
  },

  /**
   * Step 1 of a top-up: create a PayPal order the user must approve.
   */
  async startTopUp(userId, amount, frontendUrl = getSiteUrl()) {
    const value = round2(amount);
    if (!(value > 0)) {
      throw new ValidationError('Top-up amount must be greater than zero');
    }

    const order = await paypalService.createOrder({
      amount: value,
      currency: config.platform.defaultCurrency,
      description: 'ChargeNest wallet top-up',
      bookingId: `wallet:${userId}`,
      returnUrl: `${frontendUrl}/wallet`,
      cancelUrl: `${frontendUrl}/wallet?cancelled=1`,
      intent: 'CAPTURE',
    });

    return { orderId: order.orderId, approveUrl: order.approveUrl, amount: value };
  },

  /**
   * Step 2: after the user approves at PayPal, capture the order and credit the wallet.
   * Safe to call twice: the PayPal order id is unique in the ledger.
   */
  async completeTopUp(userId, orderId) {
    const existing = await prisma.walletTransaction.findUnique({ where: { paypalOrderId: orderId } });
    if (existing) {
      if (existing.userId !== userId) throw new ForbiddenError('This top-up belongs to another user');
      return { credited: false, ...(await this.getWallet(userId, { limit: 1 })) };
    }

    let capture;
    try {
      capture = await paypalService.captureOrder(orderId);
    } catch (error) {
      // A second capture of the same order (page reload, double request) is not a failure
      const alreadyCaptured = error.details?.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED');
      if (!alreadyCaptured) throw error;
      const applied = await prisma.walletTransaction.findUnique({ where: { paypalOrderId: orderId } });
      if (applied?.userId !== userId) throw error;
      return { credited: false, ...(await this.getWallet(userId, { limit: 1 })) };
    }

    if (capture.referenceId !== `wallet:${userId}`) {
      throw new ForbiddenError('This PayPal order was not created for your wallet');
    }
    if (capture.captureStatus !== 'COMPLETED') {
      throw new ValidationError(`PayPal capture is ${capture.captureStatus || capture.status}, wallet not credited`);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: capture.amount } },
        });
        await writeLedger(tx, userId, 'topup', capture.amount, {
          paypalOrderId: orderId,
          paypalRef: capture.captureId,
          note: 'Wallet top-up via PayPal',
        });
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictError('TOPUP_ALREADY_APPLIED', 'This top-up was already applied');
      }
      throw error;
    }

    return { credited: true, ...(await this.getWallet(userId, { limit: 1 })) };
  },

  /**
   * Move booking money from spendable balance into escrow. Atomic: fails if the spendable amount is too low.
   */
  async hold(tx, userId, amount, bookingId) {
    const value = round2(amount);
    const result = await tx.user.updateMany({
      where: { id: userId, walletBalance: { gte: value + config.wallet.deposit } },
      data: { walletBalance: { decrement: value }, walletHeld: { increment: value } },
    });
    if (result.count === 0) {
      throw new ValidationError(
        `Not enough spendable wallet balance for ${value}. The ${config.wallet.deposit} deposit cannot be spent. Top up your wallet.`,
        { code: 'INSUFFICIENT_WALLET_BALANCE' }
      );
    }
    await writeLedger(tx, userId, 'booking_hold', value, { bookingId, note: 'Held for booking' });
  },

  /**
   * A wallet booking must have a hold row in the ledger before its money can move.
   * Without it, releasing would push the driver's held amount below zero and create money for the host.
   */
  async assertHold(db, bookingId) {
    const hold = await db.walletTransaction.findFirst({ where: { bookingId, type: 'booking_hold' }, select: { id: true } });
    if (!hold) {
      throw new ValidationError('This booking has no wallet hold, so no money can be released. Make a new booking.', { code: 'NO_WALLET_HOLD' });
    }
  },

  /**
   * Charging finished: escrow leaves the driver, host receives the amount minus the platform fee.
   * - chargedAmount below heldAmount (used less than booked): the unused part goes back to the driver.
   * - deferHost: the host is not credited yet; releaseToHost() does it later (payout delay).
   */
  async release(tx, { driverId, hostId, heldAmount, chargedAmount = heldAmount, hostAmount, bookingId, deferHost = false }) {
    const unused = round2(heldAmount - chargedAmount);
    await tx.user.update({
      where: { id: driverId },
      data: { walletHeld: { decrement: round2(heldAmount) } },
    });
    if (unused > 0) {
      await tx.user.update({ where: { id: driverId }, data: { walletBalance: { increment: unused } } });
    }
    await writeLedger(tx, driverId, 'hold_release', chargedAmount, { bookingId, note: 'Booking paid' });
    if (unused > 0) {
      await writeLedger(tx, driverId, 'refund', unused, { bookingId, note: 'Unused time returned' });
    }

    if (deferHost) return;
    await this.releaseToHost(tx, { hostId, hostAmount, bookingId });
  },

  /**
   * Credit the host for a finished booking (now, or when the payout delay has passed).
   */
  async releaseToHost(tx, { hostId, hostAmount, bookingId }) {
    await tx.user.update({
      where: { id: hostId },
      data: { walletBalance: { increment: round2(hostAmount) } },
    });
    await writeLedger(tx, hostId, 'host_credit', hostAmount, { bookingId, note: 'Booking earnings (after platform fee)' });
  },

  /**
   * Give escrow back to the driver (cancellation or void).
   */
  async returnHold(tx, driverId, amount, bookingId, note = 'Hold returned') {
    const value = round2(amount);
    if (value <= 0) return;
    await tx.user.update({
      where: { id: driverId },
      data: { walletHeld: { decrement: value }, walletBalance: { increment: value } },
    });
    await writeLedger(tx, driverId, 'refund', value, { bookingId, note });
  },

  /**
   * Refund after release (dispute): driver is credited, host gives back its share as far as its balance allows.
   * The platform absorbs any shortfall so the driver is made whole.
   */
  async refundAfterRelease(tx, { driverId, hostId, amount, bookingId, hostPending = false }) {
    const value = round2(amount);
    const hostShare = round2(value * (1 - config.platform.feePercent / 100));
    // Host not credited yet (payout delay): nothing to take back, the pending amount shrinks instead
    const host = hostPending ? null : await tx.user.findUnique({ where: { id: hostId }, select: { walletBalance: true } });
    const hostDebit = hostPending ? 0 : Math.min(hostShare, num(host.walletBalance));

    if (hostDebit > 0) {
      await tx.user.update({ where: { id: hostId }, data: { walletBalance: { decrement: hostDebit } } });
      await writeLedger(tx, hostId, 'refund', hostDebit, { bookingId, note: 'Dispute refund taken from earnings' });
    }
    await tx.user.update({ where: { id: driverId }, data: { walletBalance: { increment: value } } });
    await writeLedger(tx, driverId, 'refund', value, { bookingId, note: 'Dispute refund' });
  },

  /**
   * Credit a host for money PayPal already collected (paid damage invoice).
   */
  async creditHost(tx, hostId, amount, { bookingId, note, paypalRef }) {
    await tx.user.update({ where: { id: hostId }, data: { walletBalance: { increment: round2(amount) } } });
    await writeLedger(tx, hostId, 'damage_charge', amount, { bookingId, note, paypalRef });
  },

  /**
   * Withdraw spendable balance to the user's PayPal account. The deposit stays.
   */
  async withdraw(userId, amount) {
    const value = round2(amount);
    if (!(value > 0)) throw new ValidationError('Withdrawal amount must be greater than zero');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { paypalEmail: true, email: true },
    });
    // The saved PayPal email, else the account email
    const payoutEmail = user?.paypalEmail || user?.email;
    if (!payoutEmail) {
      throw new ValidationError('Add your PayPal email in your profile before withdrawing');
    }

    // Take the money first (atomic), pay out, put it back if PayPal fails
    const taken = await prisma.user.updateMany({
      where: { id: userId, walletBalance: { gte: value + config.wallet.deposit } },
      data: { walletBalance: { decrement: value } },
    });
    if (taken.count === 0) {
      throw new ValidationError(
        `You can withdraw up to ${spendableAmount((await this.getWallet(userId, { limit: 0 })).wallet.balance)}. The ${config.wallet.deposit} deposit stays in your wallet.`
      );
    }

    let payout;
    try {
      payout = await paypalService.createPayout({
        recipientEmail: payoutEmail,
        amount: value,
        currency: config.platform.defaultCurrency,
        note: 'ChargeNest wallet withdrawal',
        bookingId: `withdraw_${userId}`,
      });
    } catch (error) {
      await prisma.user.update({ where: { id: userId }, data: { walletBalance: { increment: value } } });
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await writeLedger(tx, userId, 'withdrawal', value, {
        paypalRef: payout.payoutBatchId,
        note: payout.simulated ? 'Withdrawal (sandbox payout simulated)' : 'Withdrawal to PayPal',
      });
    });

    return { payoutBatchId: payout.payoutBatchId, status: payout.status, simulated: !!payout.simulated };
  },

  /**
   * Close the wallet: pay out everything, deposit included. Blocked while money is still at stake.
   */
  async closeWallet(userId) {
    const [openBookings, openDisputes, unpaidInvoices, user] = await Promise.all([
      prisma.booking.count({
        where: {
          status: { in: ['pending', 'authorized', 'in_progress', 'disputed'] },
          OR: [{ driverId: userId }, { charger: { hostId: userId } }],
        },
      }),
      prisma.dispute.count({
        where: { status: { in: ['open', 'ai_reviewed', 'pending_admin'] }, raisedById: userId },
      }),
      prisma.invoice.count({
        where: { recipientId: userId, status: { in: ['draft', 'sent'] } },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true, walletHeld: true, paypalEmail: true, email: true } }),
    ]);

    if (openBookings > 0 || openDisputes > 0 || unpaidInvoices > 0 || num(user?.walletHeld) > 0) {
      throw new ConflictError(
        'WALLET_IN_USE',
        'Finish your open bookings, disputes and unpaid invoices before closing your wallet'
      );
    }
    const amount = round2(num(user?.walletBalance));
    if (!(amount > 0)) throw new ValidationError('Your wallet is already empty');
    const payoutEmail = user.paypalEmail || user.email;
    if (!payoutEmail) {
      throw new ValidationError('Add your PayPal email in your profile before closing your wallet');
    }

    // Same pattern as withdraw: take the money atomically, pay out, put it back if PayPal fails
    const taken = await prisma.user.updateMany({
      where: { id: userId, walletBalance: { gte: amount }, walletHeld: 0 },
      data: { walletBalance: { decrement: amount } },
    });
    if (taken.count === 0) throw new ConflictError('WALLET_CHANGED', 'Your wallet changed. Try again.');

    let payout;
    try {
      payout = await paypalService.createPayout({
        recipientEmail: payoutEmail,
        amount,
        currency: config.platform.defaultCurrency,
        note: 'ChargeNest wallet closed',
        bookingId: `close_${userId}`,
      });
    } catch (error) {
      await prisma.user.update({ where: { id: userId }, data: { walletBalance: { increment: amount } } });
      throw error;
    }

    await prisma.$transaction(async (tx) => {
      await writeLedger(tx, userId, 'withdrawal', amount, {
        paypalRef: payout.payoutBatchId,
        note: 'Wallet closed, deposit returned',
      });
    });

    return { amount, payoutBatchId: payout.payoutBatchId, status: payout.status, simulated: !!payout.simulated };
  },
};

export default walletService;
