import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { paypalService } from '../src/services/paypal.service.js';

// Real credentials are set in tests/setup.js, so force mock mode with the switch
const saved = process.env.PAYPAL_MOCK;
beforeEach(() => { process.env.PAYPAL_MOCK = 'true'; });
afterEach(() => {
  if (saved === undefined) delete process.env.PAYPAL_MOCK;
  else process.env.PAYPAL_MOCK = saved;
  process.env.NODE_ENV = 'test';
});

test('mock mode is on with PAYPAL_MOCK=true and off with PAYPAL_MOCK=false', () => {
  assert.equal(paypalService.isMock(), true);
  process.env.PAYPAL_MOCK = 'false';
  assert.equal(paypalService.isMock(), false);
});

test('mock mode is never on in production', () => {
  process.env.NODE_ENV = 'production';
  assert.equal(paypalService.isMock(), false);
});

test('a mock top-up order is approved by returning to the app and captures the amount given', async () => {
  const order = await paypalService.createOrder({
    amount: 750.5,
    currency: 'INR',
    description: 'Wallet top-up',
    bookingId: 'wallet:u1',
    returnUrl: 'http://localhost:5174/wallet',
    cancelUrl: 'http://localhost:5174/wallet?cancelled=1',
    intent: 'CAPTURE',
  });
  assert.match(order.approveUrl, /^http:\/\/localhost:5174\/wallet\?token=MOCK-ORDER-/);

  const capture = await paypalService.captureOrder(order.orderId);
  assert.equal(capture.captureStatus, 'COMPLETED');
  assert.equal(capture.referenceId, 'wallet:u1');
  assert.equal(capture.amount, 750.5);
  assert.equal(capture.currency, 'INR');
});

test('a mock authorization can be captured partly, refunded and voided', async () => {
  const order = await paypalService.createOrder({
    amount: 300, description: 'Booking', bookingId: 'b1', returnUrl: 'http://x/y', cancelUrl: 'http://x/z',
  });
  const auth = await paypalService.authorizeOrder(order.orderId);
  assert.equal(auth.authorizedAmount, 300);

  const capture = await paypalService.captureAuthorization(auth.authorizationId, 120, 'INR');
  assert.equal(capture.amount, 120);
  const refund = await paypalService.refundCapture(capture.captureId, 20, 'INR');
  assert.equal(refund.amount, 20);

  assert.deepEqual(await paypalService.voidAuthorization(auth.authorizationId), { voided: true });
});

test('a mock invoice goes from draft to sent', async () => {
  const draft = await paypalService.createInvoice({
    recipientEmail: 'a@b.test', amount: 200, description: 'Damage', note: 'n',
  });
  await paypalService.sendInvoice(draft.invoiceId);
  const invoice = await paypalService.getInvoice(draft.invoiceId);
  assert.equal(invoice.status, 'SENT');
  assert.match(invoice.recipientViewUrl, /sandbox\.paypal\.com/);
});

test('an order id that did not come from the mock is rejected', async () => {
  await assert.rejects(() => paypalService.captureOrder('REAL-ORDER-1'), /unknown id/);
});
