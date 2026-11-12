import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { walletService } from '../services/walletService';
import { userService } from '../services/userService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import { 
  Wallet, DollarSign, CreditCard, Lock, TrendingUp, TrendingDown, 
  Clock, CheckCircle, AlertCircle, XCircle, ArrowUpRight, ArrowDownLeft,
  Plus, RefreshCw, ExternalLink, Info, Sparkles
} from 'lucide-react';

const TOPUP_PRESETS = [50, 100, 250, 500];
const TOPUP_MIN = 1;
const TOPUP_MAX = 10000;
const WITHDRAW_MIN = 1;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const money = (value, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value || 0);

// Get transaction icon and color based on type
// Debits: hold, payment, fee, withdrawal, debit
// Credits: top_up, credit, payout_received, refund, release
const getTransactionStyle = (type, amount) => {
  const typeStr = (type || '').toLowerCase();
  // Explicit debit types
  const isDebit = typeStr.includes('hold') || typeStr.includes('held') || 
                  typeStr.includes('payment') || typeStr.includes('fee') || 
                  typeStr.includes('withdrawal') || typeStr.includes('debit') ||
                  typeStr.includes('charge') || typeStr.includes('booking');
  // Explicit credit types
  const isCredit = typeStr.includes('top_up') || typeStr.includes('topup') ||
                   typeStr.includes('credit') || typeStr.includes('payout') ||
                   typeStr.includes('refund') || typeStr.includes('release') ||
                   typeStr.includes('earning');
  
  // If type doesn't match, fall back to amount sign
  const showAsCredit = isCredit || (!isDebit && amount > 0);
  
  if (showAsCredit) {
    return {
      icon: ArrowDownLeft,
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      amountColor: 'text-green-600 dark:text-green-400',
      prefix: '+'
    };
  }
  return {
    icon: ArrowUpRight,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    amountColor: 'text-red-600 dark:text-red-400',
    prefix: '-'
  };
};

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

  // Withdraw to PayPal (hosts and drivers)
  const [paypalEmail, setPaypalEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTouched, setWithdrawTouched] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  // Same rules as the backend: 1 to 10000, at most 2 decimals
  const amountError = (() => {
    if (amount === '') return null; // Don't show error for empty (handled by disabled button)
    const value = Number(amount);
    if (!Number.isFinite(value)) return 'Enter a valid number';
    if (value < TOPUP_MIN) return `Minimum is $${TOPUP_MIN}`;
    if (value > TOPUP_MAX) return `Maximum is $${TOPUP_MAX.toLocaleString('en-US')}`;
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) return 'Max 2 decimal places';
    return null;
  })();

  const isValidAmount = amount !== '' && !amountError;

  const load = useCallback(async () => {
    const [walletData, invoiceList, profile] = await Promise.all([
      walletService.getWallet(),
      walletService.getInvoices().catch(() => []),
      userService.getProfile().catch(() => null),
    ]);
    setData(walletData);
    setInvoices(invoiceList);
    setPaypalEmail(profile?.paypalEmail || '');
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
          setNotice(result.credited === false ? 'This top-up was already added.' : '🎉 Money added to your wallet!');
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
    if (!isValidAmount) return;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

    const wallet = data?.wallet;
  const currency = wallet?.currency || 'USD';

  // Same rules as the backend: more than 0, at most 2 decimals, not above the spendable balance (the deposit stays)
  const maxWithdraw = Math.max(0, Number(wallet?.spendable) || 0);
  const withdrawError = (() => {
    if (withdrawAmount === '') return null;
    const value = Number(withdrawAmount);
    if (!Number.isFinite(value)) return 'Enter a valid number';
    if (!/^\d+(\.\d{1,2})?$/.test(withdrawAmount)) return 'Max 2 decimal places';
    if (value < WITHDRAW_MIN) return `Minimum is ${money(WITHDRAW_MIN, currency)}`;
    if (value > maxWithdraw) return `You can withdraw up to ${money(maxWithdraw, currency)}`;
    return null;
  })();
  // Withdrawing is blocked while the email box is open, so a typed-but-unsaved email can't be skipped
  const emailPending = editingEmail || !paypalEmail;
  const canWithdraw = !emailPending && withdrawAmount !== '' && !withdrawError;
  const emailError = emailInput && !EMAIL_RE.test(emailInput) ? 'Enter a valid email address' : null;

  const handleSaveEmail = async () => {
    if (!EMAIL_RE.test(emailInput)) return;
    try {
      setWithdrawBusy(true);
      setError(null);
      const updated = await userService.updateProfile({ paypalEmail: emailInput.trim() });
      setPaypalEmail(updated?.paypalEmail || emailInput.trim());
      setEditingEmail(false);
      setNotice('PayPal email saved.');
    } catch (err) {
      setError(err.message || 'Could not save the PayPal email');
    } finally {
      setWithdrawBusy(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawTouched(true);
    if (!canWithdraw) return;
    try {
      setWithdrawBusy(true);
      setError(null);
      const value = Number(withdrawAmount);
      await walletService.withdraw(value);
      setWithdrawAmount('');
      setWithdrawTouched(false);
      setNotice(`${money(value, currency)} is on its way to ${paypalEmail}.`);
      await load();
      // The message is at the top of the page; bring it into view
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Could not withdraw');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setWithdrawBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Wallet</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your ChargeNest balance</p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        {wallet?.paypalMock && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-xl">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">PayPal Mock Mode</p>
              <p className="mt-1 text-blue-700 dark:text-blue-400">No PayPal credentials configured. Payments are simulated — any valid amount is instantly added.</p>
            </div>
          </div>
        )}

        {wallet && !wallet.depositMet && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Add {money(wallet.shortfall, currency)} to get started
              </p>
              <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">
                Your wallet needs {money(wallet.minBalance, currency)} before you can book or list a charger.
                {money(wallet.deposit, currency)} stays as a damage deposit.
              </p>
            </div>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Balance */}
          <Card className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Balance</span>
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <DollarSign className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{money(wallet?.balance, currency)}</p>
          </Card>

          {/* Held */}
          <Card className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">On Hold</span>
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{money(wallet?.held, currency)}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Reserved for bookings</p>
          </Card>

          {/* Spendable */}
          <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-green-600 dark:text-green-400">Available to Spend</span>
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">{money(wallet?.spendable, currency)}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Ready for booking</p>
          </Card>
        </div>

        {/* Deposit Status */}
        {wallet && (
          <Card className="p-4 flex items-center justify-between bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                wallet.depositMet 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-amber-100 dark:bg-amber-900/30'
              }`}>
                <Lock className={`w-5 h-5 ${
                  wallet.depositMet 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Damage Deposit</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {wallet.depositMet 
                    ? `${money(wallet.deposit, currency)} securely locked` 
                    : `${money(wallet.deposit, currency)} required`}
                </p>
              </div>
            </div>
            <Badge variant={wallet.depositMet ? 'success' : 'warning'} className="text-xs">
              {wallet.depositMet ? '✓ Funded' : 'Pending'}
            </Badge>
          </Card>
        )}

        {wallet?.pendingPayout > 0 && (
          <Card className="p-4 flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-purple-800 dark:text-purple-300">Earnings Pending</p>
              <p className="text-sm text-purple-700 dark:text-purple-400">
                {money(wallet.pendingPayout, currency)} will be available after payout delay
              </p>
            </div>
          </Card>
        )}

        {/* Add Money Section */}
        <Card className="p-6 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Money</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top up your wallet with PayPal</p>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick select
            </label>
            <div className="grid grid-cols-4 gap-3">
              {TOPUP_PRESETS.map(preset => (
                <button
                  key={preset}
                  onClick={() => { setAmount(String(preset)); setTouched(false); setError(null); }}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    Number(amount) === preset 
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-102'
                  }`}
                >
                  ${preset.toLocaleString('en-US')}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div className="mb-5">
            <label htmlFor="topup-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Or enter custom amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-gray-500 dark:text-gray-400 text-lg font-medium">$</span>
              </div>
              <input
                id="topup-amount"
                type="number"
                inputMode="decimal"
                min={TOPUP_MIN}
                max={TOPUP_MAX}
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                onBlur={() => setTouched(true)}
                placeholder="Enter amount"
                aria-label="Top-up amount"
                aria-invalid={touched && !!amountError}
                aria-describedby={amountError ? "topup-amount-error" : undefined}
                className={`w-full pl-10 pr-4 py-3.5 text-lg font-medium rounded-xl border-2 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 ${
                  touched && amountError
                    ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                    : amount && !amountError
                    ? 'border-green-400 dark:border-green-500 focus:border-green-500'
                    : 'border-gray-200 dark:border-gray-600 focus:border-primary-500 dark:focus:border-primary-400'
                }`}
              />
              {amount && !amountError && (
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              )}
            </div>
            {touched && amountError && (
              <p id="topup-amount-error" role="alert" className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 mt-2">
                <AlertCircle className="w-4 h-4" />
                {amountError}
              </p>
            )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Min: ${TOPUP_MIN} • Max: ${TOPUP_MAX.toLocaleString('en-US')}
            </p>
          </div>

          {/* Pay Button */}
          <Button 
            onClick={handleTopUp} 
            disabled={busy || !isValidAmount}
            className="w-full py-3.5 text-base font-medium"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loading size="sm" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                {isValidAmount ? `Pay $${Number(amount).toLocaleString('en-US')} with PayPal` : 'Enter amount to continue'}
              </span>
            )}
          </Button>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            {wallet?.paypalMock
              ? '🧪 Mock mode: Amount is added instantly without PayPal redirect.'
              : '🔒 Secure payment via PayPal. Sandbox mode — no real money moves.'}
          </p>
        </Card>

        {/* Withdraw to PayPal */}
        <Card className="p-6 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Withdraw to PayPal</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Available to withdraw: <span className="font-medium text-gray-700 dark:text-gray-200">{money(maxWithdraw, currency)}</span>
                {wallet?.deposit > 0 && ` (the ${money(wallet.deposit, currency)} deposit stays in your wallet)`}
              </p>
            </div>
          </div>

          {wallet?.pendingPayout > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              {money(wallet.pendingPayout, currency)} of earnings will reach your balance after the payout delay.
            </p>
          )}

          {/* PayPal email */}
          <div className="mb-4">
            <label htmlFor="paypal-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              PayPal email
            </label>
            {paypalEmail && !editingEmail ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <span className="text-gray-900 dark:text-white break-all">{paypalEmail}</span>
                <button
                  type="button"
                  onClick={() => { setEmailInput(paypalEmail); setEditingEmail(true); }}
                  className="text-sm text-primary-600 dark:text-primary-400 underline flex-shrink-0"
                  style={{ minHeight: 'auto', minWidth: 'auto' }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-3">
                  <input
                    id="paypal-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={!!emailError}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
                  />
                  <Button onClick={handleSaveEmail} disabled={withdrawBusy || !EMAIL_RE.test(emailInput)}>
                    Save
                  </Button>
                  {editingEmail && (
                    <Button variant="outline" onClick={() => setEditingEmail(false)}>Cancel</Button>
                  )}
                </div>
                {emailError && (
                  <p role="alert" className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 mt-2">
                    <AlertCircle className="w-4 h-4" />{emailError}
                  </p>
                )}
                {!paypalEmail && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Add the PayPal email that should receive your money.</p>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label htmlFor="withdraw-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500 dark:text-gray-400 text-lg">$</span>
                <input
                  id="withdraw-amount"
                  type="number"
                  inputMode="decimal"
                  min={WITHDRAW_MIN}
                  max={maxWithdraw}
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  onBlur={() => setWithdrawTouched(true)}
                  placeholder="Enter amount"
                  aria-invalid={withdrawTouched && !!withdrawError}
                  aria-describedby={withdrawError ? 'withdraw-amount-error' : undefined}
                  className={`w-full pl-10 pr-4 py-3 text-lg rounded-xl border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none ${
                    withdrawTouched && withdrawError
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-gray-200 dark:border-gray-600 focus:border-primary-500'
                  }`}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => { setWithdrawAmount(maxWithdraw >= WITHDRAW_MIN ? String(Math.floor(maxWithdraw * 100) / 100) : ''); setWithdrawTouched(true); }}
                disabled={maxWithdraw < WITHDRAW_MIN}
              >
                All
              </Button>
            </div>
            {withdrawTouched && withdrawError && (
              <p id="withdraw-amount-error" role="alert" className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 mt-2">
                <AlertCircle className="w-4 h-4" />{withdrawError}
              </p>
            )}
          </div>

          <Button onClick={handleWithdraw} disabled={withdrawBusy || !canWithdraw} className="w-full py-3.5 text-base font-medium">
            {withdrawBusy ? 'Processing...' : emailPending ? 'Save your PayPal email first' : canWithdraw ? `Withdraw ${money(Number(withdrawAmount), currency)} to ${paypalEmail}` : 'Enter amount to continue'}
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
            {wallet?.paypalMock ? 'Mock mode: the payout is simulated.' : 'Sent as a PayPal payout. Sandbox mode, so no real money moves.'}
          </p>
        </Card>

        {/* Invoices */}
        {invoices.length > 0 && (
          <Card className="p-6 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Invoices</h2>
            <div className="space-y-3">
              {invoices.map(invoice => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{invoice.reason || 'Invoice'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{money(invoice.amount, invoice.currency || currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge size="sm" variant={invoice.status === 'paid' ? 'success' : 'warning'}>
                      {invoice.status}
                    </Badge>
                    {invoice.payUrl && (
                      <a
                        href={invoice.payUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        title="Open invoice"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button 
                      onClick={() => handleRefreshInvoice(invoice.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Refresh status"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Transaction History */}
        <Card className="p-6 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            {data?.transactions?.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {data?.transactions?.length ? (
            <div className="space-y-3">
              {data.transactions.map(t => {
                const style = getTransactionStyle(t.type, t.amount);
                const Icon = style.icon;
                return (
                  <div key={t.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.bgColor}`}>
                      <Icon className={`w-5 h-5 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {t.note || t.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(t.createdAt).toLocaleString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <p className={`font-semibold ${style.amountColor}`}>
                      {style.prefix}{money(Math.abs(t.amount), currency)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">No activity yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your transactions will appear here
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
