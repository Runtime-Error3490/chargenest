import axios from 'axios';
import { config } from '../config/index.js';
import { PaymentError } from '../utils/errors.js';
import { mockPaypalTransport } from './paypal.mock.js';

/**
 * Get PayPal access token
 */
let cachedToken = null;
let cachedTokenExpiresAt = 0;
const TOKEN_SAFETY_MS = 60 * 1000;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }
  if (!config.paypal.clientId || !config.paypal.clientSecret) {
    throw new PaymentError('PayPal is not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
  }
  try {
    const auth = Buffer.from(
      `${config.paypal.clientId}:${config.paypal.clientSecret}`
    ).toString('base64');

    const response = await axios.post(
      `${config.paypal.apiUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    cachedToken = response.data.access_token;
    cachedTokenExpiresAt = Date.now() + (response.data.expires_in || 0) * 1000 - TOKEN_SAFETY_MS;
    return cachedToken;
  } catch (error) {
    console.error('PayPal auth error:', error.response?.data || error.message);
    throw new PaymentError('Failed to authenticate with PayPal');
  }
}

let mockWarned = false;

/**
 * Mock mode: PayPal calls are simulated in memory. On when PAYPAL_MOCK=true, or when the
 * client id or secret is missing or still a placeholder. Never on in production.
 */
function isMockMode() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.PAYPAL_MOCK === 'true') return true;
  if (process.env.PAYPAL_MOCK === 'false') return false;
  const looksUnset = (v) => !v || /^your-|placeholder/i.test(v);
  return looksUnset(config.paypal.clientId) || looksUnset(config.paypal.clientSecret);
}

/**
 * Network seam. Every PayPal call goes through `transport.request(method, endpoint, data)`.
 * Tests swap it with `paypalService.setTransport(fake)`; production uses the HTTP one below.
 */
let transport = null;

/**
 * Make authenticated PayPal API request
 */
async function paypalRequest(method, endpoint, data = null) {
  if (transport) {
    return transport.request(method, endpoint, data);
  }
  if (isMockMode()) {
    if (!mockWarned) {
      mockWarned = true;
      console.warn('PayPal MOCK MODE: no real PayPal credentials set, payments are simulated. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to use the sandbox.');
    }
    return mockPaypalTransport.request(method, endpoint, data);
  }
  const accessToken = await getAccessToken();

  try {
    const response = await axios({
      method,
      url: `${config.paypal.apiUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
      data,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired or revoked: drop the cache so the next call fetches a new one
      cachedToken = null;
      cachedTokenExpiresAt = 0;
    }
    console.error('PayPal API error:', {
      endpoint,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new PaymentError(
      error.response?.data?.message || 'PayPal API request failed',
      error.response?.data
    );
  }
}

export const paypalService = {
  /**
   * Replace the HTTP layer (pass null to restore it). The fake must expose
   * `request(method, endpoint, data)` and return the parsed PayPal JSON body.
   */
  setTransport(fake) {
    transport = fake;
  },

  /**
   * True when PayPal is simulated because no credentials are set
   */
  isMock: isMockMode,

  /**
   * Fetch an OAuth access token (client credentials)
   */
  getAccessToken,

  /**
   * Create an order with AUTHORIZE intent
   */
  async createOrder({
    amount,
    currency = 'INR',
    description,
    bookingId,
    mandateId = null,
    returnUrl,
    cancelUrl,
    intent = 'AUTHORIZE',
  }) {
    const orderData = {
      intent,
      purchase_units: [
        {
          reference_id: bookingId,
          description,
          custom_id: mandateId || bookingId, // For mandate tracking
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'EV Charging Marketplace',
            locale: 'en-IN',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    };

    const order = await paypalRequest('POST', '/v2/checkout/orders', orderData);

    // Find the approve link
    const approveLink = order.links.find(link => link.rel === 'payer-action');

    return {
      orderId: order.id,
      status: order.status,
      approveUrl: approveLink?.href,
    };
  },

  /**
   * Authorize an approved order
   */
  async authorizeOrder(orderId) {
    const result = await paypalRequest(
      'POST',
      `/v2/checkout/orders/${orderId}/authorize`,
      {}
    );

    // Extract authorization ID
    const authId = result.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
    const authAmount = result.purchase_units?.[0]?.payments?.authorizations?.[0]?.amount;

    return {
      orderId: result.id,
      status: result.status,
      authorizationId: authId,
      authorizedAmount: authAmount ? parseFloat(authAmount.value) : null,
      currency: authAmount?.currency_code,
    };
  },

  /**
   * Capture an authorization
   */
  async captureAuthorization(authorizationId, amount, currency = 'INR', finalCapture = true) {
    const captureData = {
      amount: {
        currency_code: currency,
        value: amount.toFixed(2),
      },
      final_capture: finalCapture,
    };

    const result = await paypalRequest(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/capture`,
      captureData
    );

    return {
      captureId: result.id,
      status: result.status,
      amount: parseFloat(result.amount.value),
      currency: result.amount.currency_code,
    };
  },

  /**
   * Void an authorization (cancel before capture)
   */
  async voidAuthorization(authorizationId) {
    await paypalRequest(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/void`,
      {}
    );

    return { voided: true };
  },

  /**
   * Refund a captured payment
   */
  async refundCapture(captureId, amount = null, currency = 'INR') {
    const refundData = amount ? {
      amount: {
        currency_code: currency,
        value: amount.toFixed(2),
      },
    } : {};

    const result = await paypalRequest(
      'POST',
      `/v2/payments/captures/${captureId}/refund`,
      refundData
    );

    return {
      refundId: result.id,
      status: result.status,
      amount: parseFloat(result.amount.value),
      currency: result.amount.currency_code,
    };
  },

  /**
   * Create a payout to host
   */
  async createPayout({
    recipientEmail,
    amount,
    currency = 'INR',
    note,
    bookingId,
  }) {
    const payoutData = {
      sender_batch_header: {
        sender_batch_id: `payout_${bookingId}_${Date.now()}`,
        email_subject: 'You have received a payment from EV Charging Marketplace',
        email_message: note,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          receiver: recipientEmail,
          amount: {
            value: amount.toFixed(2),
            currency: currency,
          },
          note: note,
          sender_item_id: bookingId,
        },
      ],
    };

    try {
      const result = await paypalRequest('POST', '/v1/payments/payouts', payoutData);

      return {
        payoutBatchId: result.batch_header.payout_batch_id,
        status: result.batch_header.batch_status,
      };
    } catch (error) {
      // Outside sandbox a failed payout must fail loudly, never look paid
      if (config.paypal.mode !== 'sandbox') {
        throw error;
      }
      // Payouts might not be enabled in sandbox - return simulated result
      console.warn('Payout failed (possibly not enabled in sandbox):', error.message);
      return {
        payoutBatchId: `simulated_${Date.now()}`,
        status: 'SIMULATED',
        simulated: true,
        note: 'Payouts may not be enabled in sandbox. In production, this would send real payment.',
      };
    }
  },

  /**
   * Capture an approved CAPTURE-intent order (wallet top-up)
   */
  async captureOrder(orderId) {
    const result = await paypalRequest('POST', `/v2/checkout/orders/${orderId}/capture`, {});
    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];

    return {
      orderId: result.id,
      status: result.status,
      referenceId: result.purchase_units?.[0]?.reference_id,
      captureId: capture?.id,
      captureStatus: capture?.status,
      amount: capture ? parseFloat(capture.amount.value) : null,
      currency: capture?.amount?.currency_code,
    };
  },

  /**
   * Invoicing v2: create a draft invoice, returns the invoice id
   */
  async createInvoice({ recipientEmail, recipientName, amount, currency = 'INR', description, note }) {
    const { invoice_number: invoiceNumber } = await paypalRequest(
      'POST',
      '/v2/invoicing/generate-next-invoice-number'
    );

    const draft = await paypalRequest('POST', '/v2/invoicing/invoices', {
      detail: {
        invoice_number: invoiceNumber,
        currency_code: currency,
        note,
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: recipientEmail,
            name: recipientName ? { given_name: recipientName } : undefined,
          },
        },
      ],
      items: [
        {
          name: description,
          quantity: '1',
          unit_amount: { currency_code: currency, value: amount.toFixed(2) },
        },
      ],
    });

    // Response only carries a link whose last path segment is the invoice id
    const id = draft.href.split('/').pop();
    return { invoiceId: id, invoiceNumber, href: draft.href };
  },

  /**
   * Invoicing v2: send a draft invoice to the recipient by email
   */
  async sendInvoice(invoiceId) {
    await paypalRequest('POST', `/v2/invoicing/invoices/${invoiceId}/send`, {
      send_to_recipient: true,
      send_to_invoicer: false,
    });
    return { sent: true };
  },

  /**
   * Invoicing v2: read an invoice (status, payer view link)
   */
  async getInvoice(invoiceId) {
    const invoice = await paypalRequest('GET', `/v2/invoicing/invoices/${invoiceId}`);
    return {
      status: invoice.status,
      recipientViewUrl: invoice.detail?.metadata?.recipient_view_url,
    };
  },

  /**
   * Customer Disputes v1: read a dispute that a buyer opened with PayPal
   */
  async getDispute(disputeId) {
    return paypalRequest('GET', `/v1/customer/disputes/${disputeId}`);
  },

  /**
   * Customer Disputes v1: accept the buyer's claim (seller agrees to refund)
   */
  async acceptDisputeClaim(disputeId, note) {
    return paypalRequest('POST', `/v1/customer/disputes/${disputeId}/accept-claim`, {
      note,
    });
  },

  /**
   * Customer Disputes v1: deny the buyer's claim and give the seller's reason
   */
  async denyDispute(disputeId, note) {
    return paypalRequest('POST', `/v1/customer/disputes/${disputeId}/deny-offer`, {
      note,
    });
  },

  /**
   * Customer Disputes v1: send a message to the buyer (seller response)
   */
  async sendDisputeMessage(disputeId, message) {
    return paypalRequest('POST', `/v1/customer/disputes/${disputeId}/send-message`, {
      message,
    });
  },

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(headers, body) {
    const verifyData = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.paypal.webhookId,
      webhook_event: body,
    };

    try {
      const result = await paypalRequest(
        'POST',
        '/v1/notifications/verify-webhook-signature',
        verifyData
      );

      return result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Webhook verification failed:', error.message);
      return false;
    }
  },
};

export default paypalService;
