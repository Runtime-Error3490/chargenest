import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { paypalService } from './paypal.service.js';
import { walletService, round2 } from './wallet.service.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';

/**
 * Damage invoices. A host who finds damage after a session sends the driver a PayPal invoice.
 * When PayPal reports it paid, the host wallet is credited (minus the platform fee).
 */

function format(invoice) {
  return {
    id: invoice.id,
    bookingId: invoice.bookingId,
    amount: parseFloat(invoice.amount),
    currency: invoice.currency,
    reason: invoice.reason,
    status: invoice.status,
    paypalInvoiceId: invoice.paypalInvoiceId,
    payUrl: invoice.paypalInvoiceUrl,
    createdAt: invoice.createdAt,
    paidAt: invoice.paidAt,
  };
}

export const invoiceService = {
  /**
   * Host creates and sends an invoice for a finished booking on one of their chargers.
   */
  async createDamageInvoice(hostId, { bookingId, amount, description }) {
    const value = round2(amount);
    if (!(value > 0)) throw new ValidationError('Invoice amount must be greater than zero');

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: { select: { hostId: true, name: true } },
        driver: { select: { id: true, email: true, name: true } },
      },
    });
    if (!booking) throw new NotFoundError('Booking');
    if (booking.charger.hostId !== hostId) throw new ForbiddenError('This booking is not on your charger');
    if (!['completed', 'disputed'].includes(booking.status)) {
      throw new ValidationError('You can only invoice a booking after the session has ended');
    }

    const cap = parseFloat(booking.totalAmount) * 5;
    if (value > cap) {
      throw new ValidationError(`Invoice cannot exceed ${cap.toFixed(2)} for this booking`);
    }

    // Invoice in the platform currency. An older booking may carry INR, which PayPal Invoicing rejects.
    const currency = config.platform.defaultCurrency;

    const draft = await paypalService.createInvoice({
      recipientEmail: booking.driver.email,
      recipientName: booking.driver.name,
      amount: value,
      currency,
      description: `Damage claim: ${booking.charger.name}`,
      note: description,
    });

    const invoice = await prisma.invoice.create({
      data: {
        bookingId,
        issuerId: hostId,
        recipientId: booking.driver.id,
        paypalInvoiceId: draft.invoiceId,
        amount: value,
        currency,
        reason: description,
        status: 'draft',
      },
    });

    await paypalService.sendInvoice(draft.invoiceId);
    const details = await paypalService.getInvoice(draft.invoiceId).catch(() => ({}));

    const sent = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'sent', paypalInvoiceUrl: details.recipientViewUrl || null },
    });

    return format(sent);
  },

  async listForUser(userId) {
    const invoices = await prisma.invoice.findMany({
      where: { OR: [{ issuerId: userId }, { recipientId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return invoices.map((i) => ({
      ...format(i),
      direction: i.issuerId === userId ? 'issued' : 'received',
    }));
  },

  /**
   * Ask PayPal for the current status (used by the UI refresh button and as a fallback to the webhook).
   */
  async refresh(invoiceId, userId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.issuerId !== userId && invoice.recipientId !== userId) {
      throw new ForbiddenError('You do not have access to this invoice');
    }
    if (invoice.status === 'paid' || !invoice.paypalInvoiceId) return format(invoice);

    const remote = await paypalService.getInvoice(invoice.paypalInvoiceId);
    if (['PAID', 'MARKED_AS_PAID'].includes(remote.status)) {
      return format(await this.markPaid(invoice.paypalInvoiceId));
    }
    return format(invoice);
  },

  /**
   * Mark an invoice paid and credit the host. Idempotent: a paid invoice is never credited twice.
   */
  async markPaid(paypalInvoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { paypalInvoiceId } });
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.status === 'paid') return invoice;

    const amount = parseFloat(invoice.amount);
    const hostAmount = round2(amount * (1 - config.platform.feePercent / 100));

    return prisma.$transaction(async (tx) => {
      // Flip the status first with a guard so a duplicate webhook cannot double-credit
      const flipped = await tx.invoice.updateMany({
        where: { id: invoice.id, status: { not: 'paid' } },
        data: { status: 'paid', paidAt: new Date() },
      });
      if (flipped.count === 1) {
        await walletService.creditHost(tx, invoice.issuerId, hostAmount, {
          bookingId: invoice.bookingId,
          note: 'Damage invoice paid (after platform fee)',
          paypalRef: paypalInvoiceId,
        });
      }
      return tx.invoice.findUnique({ where: { id: invoice.id } });
    });
  },
};

export default invoiceService;
