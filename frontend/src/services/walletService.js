import api from './api';

const captures = new Map();

// PayPal-funded wallet and invoices. The minimum balance doubles as the damage deposit.
export const walletService = {
  // { wallet: {balance, held, spendable, minBalance, deposit, shortfall, depositMet, currency}, transactions: [] }
  async getWallet() {
    const response = await api.get('/payments/wallet');
    return response.data.data;
  },

  // Creates a PayPal order. Send the user to approveUrl, PayPal returns them to /wallet
  async startTopUp(amount) {
    const response = await api.post('/payments/wallet/topup', { amount });
    return response.data.data;
  },

  // Called with the order id PayPal puts in the `token` query param on return.
  // One request per order: React dev mode mounts the page twice.
  completeTopUp(orderId) {
    if (!captures.has(orderId)) {
      captures.set(orderId, api.post('/payments/wallet/topup/capture', { orderId }).then((r) => r.data.data));
    }
    return captures.get(orderId);
  },

  async withdraw(amount) {
    const response = await api.post('/payments/wallet/withdraw', { amount });
    return response.data.data;
  },

  async getInvoices() {
    const response = await api.get('/payments/invoices');
    return response.data.data.invoices;
  },

  async refreshInvoice(id) {
    const response = await api.post(`/payments/invoices/${id}/refresh`);
    return response.data.data.invoice;
  },
};

export default walletService;
