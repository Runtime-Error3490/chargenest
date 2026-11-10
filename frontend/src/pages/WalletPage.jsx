import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { walletService } from '../services/walletService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';

const TOPUP_PRESETS = [500, 1000, 2500, 5000];
const TOPUP_MIN = 1;
const TOPUP_MAX = 100000;

const money = (value, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value || 0);

export default function WalletPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);

  // Same rules as the backend: 1 to 100000, at most 2 decimals
  const amountError = (() => {
    if (amount === '') return 'Enter an amount';
    const value = Number(amount);
    if (!Number.isFinite(value)) return 'Enter a valid number';
    if (value < TOPUP_MIN) return `Minimum top-up is ${TOPUP_MIN}`;
    if (value > TOPUP_MAX) return `Maximum top-up is ${TOPUP_MAX.toLocaleString('en-IN')}`;
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) return 'Use at most 2 decimal places';
    return null;
  })();

  const load = useCallback(async () => {
    const [walletData, invoiceList] = await Promise.all([
      walletService.getWallet(),
      walletService.getInvoices().catch(() => []),
    ]);
    setData(walletData);
    setInvoices(invoiceList);
  }, []);

  // On first load, finish a top-up if PayPal just sent the user back with an order id
  useEffect(() => {
    const init = async () => {
      try {
        const orderId = searchParams.get('token');
        if (searchParams.get('cancelled')) {
          setNotice('Top-up cancelled. No money was taken.');
        } else if (orderId) {
          const result = await walletService.completeTopUp(orderId);
          setNotice(result.credited === false ? 'This top-up was already added.' : 'Money added to your wallet.');
        }
        if (orderId || searchParams.get('cancelled')) setSearchParams({}, { replace: true });
        await load();
      } catch (err) {
        setError(err.message || 'Could not load your wallet');
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTopUp = async () => {
    setTouched(true);
    if (amountError) return;
    const value = Number(amount);
    try {
      setBusy(true);
      setError(null);
      const order = await walletService.startTopUp(value);
      if (!order.approveUrl) throw new Error('PayPal did not return an approval link');
      window.location.href = order.approveUrl;
    } catch (err) {
      setError(err.message || 'Could not start the top-up');
      setBusy(false);
    }
  };

  const handleRefreshInvoice = async (id) => {
    try {
      const updated = await walletService.refreshInvoice(id);
      setInvoices(prev => prev.map(i => (i.id === id ? updated : i)));
    } catch (err) {
      setError(err.message || 'Could not refresh the invoice');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  const wallet = data?.wallet;
  const currency = wallet?.currency || 'INR';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
          <p className="text-gray-600 mt-1">Funded with PayPal. Used to pay for charging.</p>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
        {notice && <div className="p-4 bg-green-50 text-green-700 rounded-lg">{notice}</div>}

        {wallet?.paypalMock && (
          <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
            <strong>PayPal mock mode.</strong> No PayPal credentials are set, so payments are simulated.
            Any valid amount is accepted and added to your wallet. No real PayPal account is used.
          </div>
        )}

        {wallet && !wallet.depositMet && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
            <p className="font-medium">
              Add {money(wallet.shortfall, currency)} to get started.
            </p>
            <p className="text-sm mt-1">
              Your wallet needs {money(wallet.minBalance, currency)} before you can book or list a charger.{' '}
              {money(wallet.deposit, currency)} of it stays as a damage deposit. The other{' '}
              {money(wallet.minBalance - wallet.deposit, currency)} is yours to spend on bookings.
            </p>
          </div>
        )}

        <Card className="p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Balance</p>
              <p className="text-2xl font-bold text-gray-900">{money(wallet?.balance, currency)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Held for bookings</p>
              <p className="text-2xl font-bold text-gray-900">{money(wallet?.held, currency)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Spendable</p>
              <p className="text-2xl font-bold text-green-700">{money(wallet?.spendable, currency)}</p>
            </div>
          </div>
          {wallet?.pendingPayout > 0 && (
            <p className="mt-3 text-center text-sm text-gray-600">
              {money(wallet.pendingPayout, currency)} in earnings will reach your balance after the payout delay.
            </p>
          )}
          <div className="mt-4 text-center">
            <Badge variant={wallet?.depositMet ? 'success' : 'warning'}>
              {wallet?.depositMet
                ? `${money(wallet.deposit, currency)} damage deposit is locked`
                : `Damage deposit: ${money(wallet?.deposit, currency)} (not yet funded)`}
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add money with PayPal</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {TOPUP_PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => { setAmount(String(preset)); setTouched(false); setError(null); }}
                className={`px-3 py-1 rounded-lg text-sm ${
                  Number(amount) === preset ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {money(preset, currency)}
              </button>
            ))}
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <input
                type="number"
                inputMode="decimal"
                min={TOPUP_MIN}
                max={TOPUP_MAX}
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                onBlur={() => setTouched(true)}
                placeholder={`Amount (${TOPUP_MIN} to ${TOPUP_MAX.toLocaleString('en-IN')})`}
                aria-label="Top-up amount"
                aria-invalid={touched && !!amountError}
                aria-describedby="topup-amount-error"
                className={`w-full rounded-lg shadow-sm focus:ring-green-500 ${
                  touched && amountError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-300 focus:border-green-500'
                }`}
              />
              {touched && amountError && (
                <p id="topup-amount-error" role="alert" className="text-sm text-red-600 mt-1">
                  {amountError}
                </p>
              )}
            </div>
            <Button onClick={handleTopUp} disabled={busy || !!amountError}>
              {busy ? <Loading size="sm" /> : 'Pay with PayPal'}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {wallet?.paypalMock
              ? 'Mock mode: you are sent straight back here and the amount is added.'
              : 'Sandbox mode: use a PayPal sandbox buyer account. No real money moves.'}
          </p>
        </Card>

        {invoices.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h2>
            <div className="space-y-3">
              {invoices.map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-gray-900 truncate">{invoice.reason || 'Invoice'}</p>
                    <p className="text-sm text-gray-600">{money(invoice.amount, invoice.currency || currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge size="sm">{invoice.status}</Badge>
                    {invoice.payUrl && (
                      <a
                        href={invoice.payUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-700 hover:underline"
                      >
                        Open
                      </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleRefreshInvoice(invoice.id)}>
                      Refresh
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent activity</h2>
          {data?.transactions?.length ? (
            <div className="divide-y">
              {data.transactions.map(t => (
                <div key={t.id} className="flex justify-between py-2 text-sm">
                  <div>
                    <p className="text-gray-900">{t.note || t.type}</p>
                    <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  <p className="text-gray-900">{money(t.amount, currency)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-6">No activity yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
