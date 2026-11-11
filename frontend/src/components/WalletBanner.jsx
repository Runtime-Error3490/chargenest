import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { walletService } from '../services/walletService';
import { AlertCircle } from 'lucide-react';

const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Shown until the user has put the minimum balance (damage deposit) in their wallet.
export default function WalletBanner() {
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    walletService.getWallet().then(data => setWallet(data.wallet)).catch(() => {});
  }, []);

  if (!wallet || wallet.depositMet) return null;

  return (
    <div className="p-4 mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-amber-800 dark:text-amber-300">
          Add {money(wallet.shortfall)} to start booking
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
          Your wallet needs {money(wallet.minBalance)} minimum. {money(wallet.deposit)} stays as damage deposit, the rest is yours to spend.
        </p>
      </div>
      <Link 
        to="/wallet" 
        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
      >
        Add Money
      </Link>
    </div>
  );
}
