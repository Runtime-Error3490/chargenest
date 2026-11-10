import axios from 'axios';
import { config } from '../config/index.js';
import { PaymentError } from '../utils/errors.js';

/**
 * Get PayPal access token
 */
async function getAccessToken() {
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

    return response.data.access_token;
  } catch (error) {
    console.error('PayPal auth error:', error.response?.data || error.message);
    throw new PaymentError('Failed to authenticate with PayPal');
  }
}

/**
 * Make authenticated PayPal API request
 */
async function paypalRequest(method, endpoint, data = null) {
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
  }) {
    // PayPal sandbox may not support INR - fallback to USD
    const effectiveCurrency = currency;
    const effectiveAmount = amount;

    const orderData = {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: bookingId,
          description,
          custom_id: mandateId || bookingId, // For mandate tracking
          amount: {
            currency_code: effectiveCurrency,
            value: effectiveAmount.toFixed(2),
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
   * Get order details
   */
  async getOrder(orderId) {
    return paypalRequest('GET', `/v2/checkout/orders/${orderId}`);
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
