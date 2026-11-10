import { PaymentError } from '../utils/errors.js';

/**
 * Mock PayPal, used when no PayPal credentials are set (see paypalService.isMock).
 *
 * It plugs into the same seam as the real HTTP layer: request(method, endpoint, data) returns
 * PayPal-shaped JSON. Amounts the caller sends are accepted as given. State is encoded into the
 * ids, so a captured order still works after the backend restarts (nodemon).
 */

const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function decode(id, prefix) {
  if (typeof id !== 'string' || !id.startsWith(prefix)) {
    throw new PaymentError(`Mock PayPal: unknown id ${id}`);
  }
  try {
    return JSON.parse(Buffer.from(id.slice(prefix.length), 'base64url').toString());
  } catch {
    throw new PaymentError(`Mock PayPal: unknown id ${id}`);
  }
}

const money = (value, currency) => ({ value: Number(value).toFixed(2), currency_code: currency });

// Invoice state lives in memory only; unknown ids (after a restart) read as SENT
const invoices = new Map();
let invoiceCounter = 0;

function createOrder(data) {
  const unit = data.purchase_units[0];
  const amount = Number(unit.amount.value);
  const currency = unit.amount.currency_code;
  const id = `MOCK-ORDER-${encode({ a: amount, c: currency, r: unit.reference_id, i: data.intent })}`;

  // The mock "PayPal approval page" is the return URL itself, with the params PayPal would add
  const returnUrl = data.payment_source?.paypal?.experience_context?.return_url || 'http://localhost:5173/wallet';
  const sep = returnUrl.includes('?') ? '&' : '?';
  return {
    id,
    status: 'PAYER_ACTION_REQUIRED',
    links: [
      { rel: 'payer-action', method: 'GET', href: `${returnUrl}${sep}token=${id}&PayerID=MOCKPAYER` },
    ],
  };
}

function captureOrder(orderId) {
  const o = decode(orderId, 'MOCK-ORDER-');
  return {
    id: orderId,
    status: 'COMPLETED',
    purchase_units: [{
      reference_id: o.r,
      payments: {
        captures: [{
          id: `MOCK-CAP-${encode({ a: o.a, c: o.c })}`,
          status: 'COMPLETED',
          amount: money(o.a, o.c),
        }],
      },
    }],
  };
}

function authorizeOrder(orderId) {
  const o = decode(orderId, 'MOCK-ORDER-');
  return {
    id: orderId,
    status: 'COMPLETED',
    purchase_units: [{
      reference_id: o.r,
      payments: {
        authorizations: [{
          id: `MOCK-AUTH-${encode({ a: o.a, c: o.c })}`,
          status: 'CREATED',
          amount: money(o.a, o.c),
        }],
      },
    }],
  };
}

export const mockPaypalTransport = {
  async request(method, endpoint, data) {
    let m;

    if (method === 'POST' && endpoint === '/v2/checkout/orders') return createOrder(data);

    if ((m = endpoint.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/))) return captureOrder(m[1]);
    if ((m = endpoint.match(/^\/v2\/checkout\/orders\/([^/]+)\/authorize$/))) return authorizeOrder(m[1]);
    if ((m = endpoint.match(/^\/v2\/checkout\/orders\/([^/]+)$/))) {
      const o = decode(m[1], 'MOCK-ORDER-');
      return { id: m[1], status: 'APPROVED', intent: o.i, purchase_units: [{ reference_id: o.r, amount: money(o.a, o.c) }] };
    }

    if ((m = endpoint.match(/^\/v2\/payments\/authorizations\/([^/]+)\/capture$/))) {
      const auth = decode(m[1], 'MOCK-AUTH-');
      const amount = Number(data?.amount?.value ?? auth.a);
      const currency = data?.amount?.currency_code || auth.c;
      return { id: `MOCK-CAP-${encode({ a: amount, c: currency })}`, status: 'COMPLETED', amount: money(amount, currency) };
    }
    if ((m = endpoint.match(/^\/v2\/payments\/authorizations\/([^/]+)\/void$/))) {
      decode(m[1], 'MOCK-AUTH-');
      return {};
    }
    if ((m = endpoint.match(/^\/v2\/payments\/captures\/([^/]+)\/refund$/))) {
      const cap = decode(m[1], 'MOCK-CAP-');
      const amount = Number(data?.amount?.value ?? cap.a);
      const currency = data?.amount?.currency_code || cap.c;
      return { id: `MOCK-REFUND-${Date.now()}`, status: 'COMPLETED', amount: money(amount, currency) };
    }

    if (method === 'POST' && endpoint === '/v1/payments/payouts') {
      return { batch_header: { payout_batch_id: `MOCK-PAYOUT-${Date.now()}`, batch_status: 'SUCCESS' } };
    }

    if (method === 'POST' && endpoint === '/v2/invoicing/generate-next-invoice-number') {
      invoiceCounter += 1;
      return { invoice_number: `MOCK-${String(invoiceCounter).padStart(4, '0')}` };
    }
    if (method === 'POST' && endpoint === '/v2/invoicing/invoices') {
      const id = `INV2-MOCK-${Date.now()}-${invoiceCounter}`;
      invoices.set(id, 'DRAFT');
      return { rel: 'self', method: 'GET', href: `https://api-m.sandbox.paypal.com/v2/invoicing/invoices/${id}` };
    }
    if ((m = endpoint.match(/^\/v2\/invoicing\/invoices\/([^/]+)\/send$/))) {
      invoices.set(m[1], 'SENT');
      return {};
    }
    if ((m = endpoint.match(/^\/v2\/invoicing\/invoices\/([^/]+)$/))) {
      return {
        id: m[1],
        status: invoices.get(m[1]) || 'SENT',
        detail: { metadata: { recipient_view_url: `https://www.sandbox.paypal.com/invoice/p/#${m[1]}` } },
      };
    }

    if ((m = endpoint.match(/^\/v1\/customer\/disputes\/([^/]+)(\/.*)?$/))) {
      const id = m[1];
      if (!m[2]) return { dispute_id: id, status: 'WAITING_FOR_SELLER_RESPONSE', reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' };
      return { dispute_id: id, status: m[2] === '/accept-claim' ? 'RESOLVED' : 'UNDER_REVIEW' };
    }

    if (endpoint === '/v1/notifications/verify-webhook-signature') {
      return { verification_status: 'SUCCESS' };
    }

    throw new PaymentError(`Mock PayPal: ${method} ${endpoint} is not simulated`);
  },
};

export default mockPaypalTransport;
