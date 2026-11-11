import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { paypalService } from '../src/services/paypal.service.js';

/**
 * PayPal sandbox is replaced by an axios adapter that records requests and returns canned replies.
 * Nothing leaves the machine.
 */
let calls;
let replies;
const originalAdapter = axios.defaults.adapter;

function respond(config, data, status = 200) {
  return { data, status, statusText: 'OK', headers: {}, config };
}

beforeEach(() => {
  calls = [];
  replies = {};
  axios.defaults.adapter = async (config) => {
    const url = new URL(config.url);
    const key = `${config.method.toUpperCase()} ${url.pathname}`;
    const body = typeof config.data === 'string' && config.headers['Content-Type']?.includes('json')
      ? JSON.parse(config.data)
      : config.data;
    calls.push({ key, body, headers: config.headers });

    if (key === 'POST /v1/oauth2/token') return respond(config, { access_token: 'token-123' });
    const reply = replies[key];
    if (!reply) throw Object.assign(new Error(`unexpected ${key}`), { response: { status: 404, data: { message: `unexpected ${key}` } } });
    return respond(config, typeof reply === 'function' ? reply(body) : reply);
  };
});

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

test('wallet top-up uses an Orders v2 order with CAPTURE intent', async () => {
  replies['POST /v2/checkout/orders'] = { id: 'ORDER1', status: 'CREATED', links: [{ rel: 'payer-action', href: 'https://paypal.test/approve' }] };

  const order = await paypalService.createOrder({
    amount: 750,
    currency: 'USD',
    description: 'ChargeNest wallet top-up',
    bookingId: 'wallet:user-1',
    returnUrl: 'http://app/wallet',
    cancelUrl: 'http://app/wallet?cancelled=1',
    intent: 'CAPTURE',
  });

  const sent = calls.find((c) => c.key === 'POST /v2/checkout/orders').body;
  assert.equal(sent.intent, 'CAPTURE');
  assert.equal(sent.purchase_units[0].amount.value, '750.00');
  assert.equal(sent.purchase_units[0].reference_id, 'wallet:user-1');
  assert.equal(order.approveUrl, 'https://paypal.test/approve');
});

test('booking orders still default to AUTHORIZE', async () => {
  replies['POST /v2/checkout/orders'] = { id: 'O2', status: 'CREATED', links: [] };
  await paypalService.createOrder({ amount: 100, description: 'x', bookingId: 'b', returnUrl: 'r', cancelUrl: 'c' });
  assert.equal(calls.find((c) => c.key === 'POST /v2/checkout/orders').body.intent, 'AUTHORIZE');
});

test('captureOrder reports the reference, capture id and amount', async () => {
  replies['POST /v2/checkout/orders/ORDER1/capture'] = {
    id: 'ORDER1',
    status: 'COMPLETED',
    purchase_units: [{
      reference_id: 'wallet:user-1',
      payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { value: '750.00', currency_code: 'USD' } }] },
    }],
  };
  const capture = await paypalService.captureOrder('ORDER1');
  assert.deepEqual(
    [capture.referenceId, capture.captureId, capture.captureStatus, capture.amount],
    ['wallet:user-1', 'CAP1', 'COMPLETED', 750]
  );
});

test('authorize, capture and void use the Payments v2 endpoints', async () => {
  replies['POST /v2/checkout/orders/O1/authorize'] = {
    id: 'O1',
    status: 'COMPLETED',
    purchase_units: [{ payments: { authorizations: [{ id: 'AUTH1', amount: { value: '107.00', currency_code: 'USD' } }] } }],
  };
  replies['POST /v2/payments/authorizations/AUTH1/capture'] = { id: 'CAP9', status: 'COMPLETED', amount: { value: '107.00', currency_code: 'USD' } };
  replies['POST /v2/payments/authorizations/AUTH1/void'] = {};

  const auth = await paypalService.authorizeOrder('O1');
  assert.equal(auth.authorizationId, 'AUTH1');
  assert.equal((await paypalService.captureAuthorization('AUTH1', 107, 'USD')).captureId, 'CAP9');
  assert.deepEqual(await paypalService.voidAuthorization('AUTH1'), { voided: true });
});

test('an invoice is created as a draft, then sent', async () => {
  replies['POST /v2/invoicing/generate-next-invoice-number'] = { invoice_number: '0042' };
  replies['POST /v2/invoicing/invoices'] = { href: 'https://paypal.test/v2/invoicing/invoices/INV-77' };
  replies['POST /v2/invoicing/invoices/INV-77/send'] = {};

  const draft = await paypalService.createInvoice({
    recipientEmail: 'driver@example.com',
    recipientName: 'Dana',
    amount: 250,
    currency: 'USD',
    description: 'Damage claim: Home charger',
    note: 'Scratched cable',
  });
  assert.equal(draft.invoiceId, 'INV-77');

  const body = calls.find((c) => c.key === 'POST /v2/invoicing/invoices').body;
  assert.equal(body.detail.invoice_number, '0042');
  assert.equal(body.primary_recipients[0].billing_info.email_address, 'driver@example.com');
  assert.equal(body.items[0].unit_amount.value, '250.00');

  assert.deepEqual(await paypalService.sendInvoice('INV-77'), { sent: true });
  assert.equal(calls.find((c) => c.key === 'POST /v2/invoicing/invoices/INV-77/send').body.send_to_recipient, true);
});

test('getInvoice returns status and payer link', async () => {
  replies['GET /v2/invoicing/invoices/INV-77'] = { status: 'PAID', detail: { metadata: { recipient_view_url: 'https://paypal.test/pay/INV-77' } } };
  assert.deepEqual(await paypalService.getInvoice('INV-77'), { status: 'PAID', recipientViewUrl: 'https://paypal.test/pay/INV-77' });
});

test('accepting a dispute claim posts to the Customer Disputes API', async () => {
  replies['POST /v1/customer/disputes/PP-D-1/accept-claim'] = { links: [] };
  await paypalService.acceptDisputeClaim('PP-D-1', 'Refund agreed');
  assert.equal(calls.find((c) => c.key === 'POST /v1/customer/disputes/PP-D-1/accept-claim').body.note, 'Refund agreed');
});

test('PayPal errors surface as PaymentError', async () => {
  await assert.rejects(() => paypalService.getInvoice('MISSING'), (e) => e.code === 'PAYPAL_ERROR');
});

test('webhook verification sends the transmission headers and webhook id', async () => {
  replies['POST /v1/notifications/verify-webhook-signature'] = { verification_status: 'SUCCESS' };
  const ok = await paypalService.verifyWebhookSignature(
    {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://paypal.test/cert',
      'paypal-transmission-id': 't1',
      'paypal-transmission-sig': 'sig',
      'paypal-transmission-time': '2026-11-10T00:00:00Z',
    },
    { event_type: 'INVOICING.INVOICE.PAID' }
  );
  assert.equal(ok, true);
  assert.equal(calls.find((c) => c.key === 'POST /v1/notifications/verify-webhook-signature').body.transmission_id, 't1');
});

// ---- token, payout, dispute and error paths ----

import { config } from '../src/config/index.js';

const tokenCalls = () => calls.filter((c) => c.key === 'POST /v1/oauth2/token');

test('token fetch sends Basic auth built from client id and secret', async () => {
  const token = await paypalService.getAccessToken();
  assert.equal(token, 'token-123');
  const expected = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64');
  assert.equal(tokenCalls()[0].headers.Authorization, `Basic ${expected}`);
});

test('a valid token is cached, an expired one is fetched again', async () => {
  const base = axios.defaults.adapter;
  let issued = 0;
  axios.defaults.adapter = async (cfg) => {
    if (cfg.url.endsWith('/v1/oauth2/token')) {
      issued += 1;
      return respond(cfg, { access_token: `tok-${issued}`, expires_in: 3600 });
    }
    return base(cfg);
  };
  assert.equal(await paypalService.getAccessToken(), 'tok-1');
  assert.equal(await paypalService.getAccessToken(), 'tok-1');
  assert.equal(issued, 1);

  // A 401 on an API call marks the token expired, so the next call fetches a new one
  axios.defaults.adapter = async (cfg) => {
    if (cfg.url.endsWith('/v1/oauth2/token')) {
      issued += 1;
      return respond(cfg, { access_token: `tok-${issued}`, expires_in: 3600 });
    }
    throw Object.assign(new Error('expired'), { response: { status: 401, data: { message: 'token expired' } } });
  };
  await assert.rejects(() => paypalService.getInvoice('O1'), (e) => e.code === 'PAYPAL_ERROR');
  assert.equal(await paypalService.getAccessToken(), 'tok-2');

  // Leave the module cache empty for the tests that follow
  axios.defaults.adapter = async (cfg) => {
    throw Object.assign(new Error('expired'), { response: { status: 401, data: {} } });
  };
  await assert.rejects(() => paypalService.getInvoice('O1'));
});

test('missing client id or secret fails before any HTTP call when mock mode is off', async () => {
  const saved = { ...config.paypal };
  config.paypal.clientId = '';
  config.paypal.clientSecret = '';
  process.env.PAYPAL_MOCK = 'false';
  try {
    await assert.rejects(() => paypalService.getInvoice('O1'), (e) => e.code === 'PAYPAL_ERROR' && /not configured/.test(e.message));
    assert.equal(calls.length, 0);
  } finally {
    delete process.env.PAYPAL_MOCK;
    Object.assign(config.paypal, saved);
  }
});

test('a failed token request becomes a PaymentError', async () => {
  const saved = config.paypal.clientId;
  config.paypal.clientId = 'other-client';
  axios.defaults.adapter = async () => {
    throw Object.assign(new Error('bad creds'), { response: { status: 401, data: { error: 'invalid_client' } } });
  };
  try {
    await assert.rejects(() => paypalService.getAccessToken(), (e) => e.code === 'PAYPAL_ERROR');
  } finally {
    config.paypal.clientId = saved;
  }
});

test('authorize API failure surfaces the PayPal message', async () => {
  const base = axios.defaults.adapter;
  axios.defaults.adapter = async (cfg) => {
    if (cfg.url.endsWith('/authorize')) {
      throw Object.assign(new Error('x'), { response: { status: 422, data: { message: 'ORDER_NOT_APPROVED' } } });
    }
    return base(cfg);
  };
  await assert.rejects(() => paypalService.authorizeOrder('O1'), (e) => e.message === 'ORDER_NOT_APPROVED');
});

test('payout posts a batch to the host email', async () => {
  replies['POST /v1/payments/payouts'] = { batch_header: { payout_batch_id: 'BATCH1', batch_status: 'PENDING' } };
  const res = await paypalService.createPayout({ recipientEmail: 'host@example.com', amount: 93, currency: 'USD', note: 'Booking payout', bookingId: 'b1' });
  assert.deepEqual(res, { payoutBatchId: 'BATCH1', status: 'PENDING' });
  const sent = calls.find((c) => c.key === 'POST /v1/payments/payouts').body;
  assert.equal(sent.items[0].receiver, 'host@example.com');
  assert.equal(sent.items[0].amount.value, '93.00');
});

test('payout failure is simulated only in sandbox and rethrown otherwise', async () => {
  const payout = { recipientEmail: 'h@example.com', amount: 10, note: 'n', bookingId: 'b2' };
  const savedMode = config.paypal.mode;
  try {
    config.paypal.mode = 'sandbox';
    const sim = await paypalService.createPayout(payout);
    assert.equal(sim.status, 'SIMULATED');
    assert.equal(sim.simulated, true);

    config.paypal.mode = 'live';
    await assert.rejects(() => paypalService.createPayout(payout), (e) => e.code === 'PAYPAL_ERROR');
  } finally {
    config.paypal.mode = savedMode;
  }
});

test('deny and message calls go to the Customer Disputes API', async () => {
  replies['POST /v1/customer/disputes/PP-D-2/deny-offer'] = {};
  replies['POST /v1/customer/disputes/PP-D-2/send-message'] = {};
  replies['GET /v1/customer/disputes/PP-D-2'] = { dispute_id: 'PP-D-2', status: 'OPEN' };

  await paypalService.denyDispute('PP-D-2', 'No damage found');
  await paypalService.sendDisputeMessage('PP-D-2', 'Photos attached');
  const dispute = await paypalService.getDispute('PP-D-2');

  assert.equal(calls.find((c) => c.key.endsWith('/deny-offer')).body.note, 'No damage found');
  assert.equal(calls.find((c) => c.key.endsWith('/send-message')).body.message, 'Photos attached');
  assert.equal(dispute.status, 'OPEN');
});
