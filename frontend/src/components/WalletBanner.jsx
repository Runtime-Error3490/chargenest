import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { walletService } from '../services/walletService';

// Shown until the user has put the minimum balance (damage deposit) in their wallet.
export default function WalletBanner() {
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    walletService.getWallet().then(data => setWallet(data.wallet)).catch(() => {});
  }, []);

  if (!wallet || wallet.depositMet) return null;

  return (
    <div className="p-4 mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-300 flex items-center justify-between gap-4">
      <span>
        Add {wallet.shortfall} {wallet.currency} to your wallet to start booking or listing chargers.
        {' '}{wallet.deposit} {wallet.currency} of the {wallet.minBalance} stays as a damage deposit. The rest is yours to spend.
      </span>
      <Link to="/wallet" className="font-medium underline whitespace-nowrap hover:text-yellow-900 dark:hover:text-yellow-200">Add money</Link>
    </div>
  );
}
