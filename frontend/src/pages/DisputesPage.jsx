import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Bot, ShieldCheck, ExternalLink } from 'lucide-react';
import { disputeService } from '../services/disputeService';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';

const STATUS = {
  open: { label: 'Open', variant: 'warning' },
  ai_reviewed: { label: 'AI reviewed', variant: 'primary' },
  pending_admin: { label: 'With admin', variant: 'warning' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
};

const DECISION = {
  refund_full: 'Full refund to the driver',
  refund_partial: 'Partial refund to the driver',
  release_to_host: 'Payment kept by the host',
  escalate: 'Escalated to an admin',
};

const decisionText = (d) => DECISION[d] || (d ? String(d).replace(/_/g, ' ') : null);
const date = (v) => (v ? new Date(v).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const money = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);

function DisputeRow({ item }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      try {
        setLoading(true);
        setError(null);
        setDetail(await disputeService.getDispute(item.id));
      } catch (err) {
        setError(err.message || 'Could not load this dispute');
      } finally {
        setLoading(false);
      }
    }
  };

  const status = STATUS[item.status] || { label: item.status, variant: 'default' };

  return (
    <Card className="bg-white dark:bg-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{item.chargerName}</p>
            <Badge size="sm" variant={status.variant}>{status.label}</Badge>
            {item.paypalDisputeId && <Badge size="sm" variant="primary">PayPal</Badge>}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{item.reason}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Raised {date(item.createdAt)}</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {loading && <Loading size="sm" />}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {detail && (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  What was reported ({detail.raisedBy?.role})
                </p>
                <p className="text-gray-800 dark:text-gray-100">{detail.reason}</p>
                {detail.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{detail.description}</p>}
              </div>

              {detail.aiAnalysis && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                  <p className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200 mb-1">
                    <Bot className="w-4 h-4" /> AI review
                  </p>
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {decisionText(detail.aiAnalysis.decision)}
                    {detail.aiAnalysis.refundAmount != null && ` (${money(detail.aiAnalysis.refundAmount)})`}
                  </p>
                  {detail.aiAnalysis.reasoning && <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">{detail.aiAnalysis.reasoning}</p>}
                </div>
              )}

              {detail.finalResolution ? (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                  <p className="flex items-center gap-2 font-medium text-green-800 dark:text-green-200 mb-1">
                    <ShieldCheck className="w-4 h-4" /> Final decision
                  </p>
                  <p className="text-sm text-green-900 dark:text-green-100">
                    {decisionText(detail.finalResolution.decision)}
                    {detail.finalResolution.refundAmount != null && ` (${money(detail.finalResolution.refundAmount)})`}
                  </p>
                  {detail.finalResolution.resolvedAt && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">Decided {date(detail.finalResolution.resolvedAt)}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No final decision yet. You will see it here when an admin decides.</p>
              )}

              {detail.paypalDisputeId && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  This dispute is also open with PayPal: <span className="font-mono">{detail.paypalDisputeId}</span>
                </p>
              )}

              <Link
                to={`/bookings/${item.bookingId}`}
                className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 underline"
              >
                View booking <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export default function DisputesPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await disputeService.getDisputes({ limit: 50 });
      setItems(res.data || []);
    } catch (err) {
      setError(err.message || 'Could not load your disputes');
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Disputes</h1>
            <p className="text-gray-600 dark:text-gray-400">Issues you raised, or that were raised on your bookings</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {items === null ? (
          <div className="flex justify-center py-12"><Loading size="lg" /></div>
        ) : items.length === 0 && !error ? (
          <Card className="p-8 text-center bg-white dark:bg-gray-800">
            <p className="text-gray-700 dark:text-gray-200 font-medium">No disputes</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              To report a problem, open a booking and press "Report Issue". The AI Concierge can do it too.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => <DisputeRow key={item.id} item={item} />)}
          </div>
        )}

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Need a person?{' '}
          <Link to="/support" className="underline text-primary-600 dark:text-primary-400">Contact support</Link>
        </p>
      </div>
    </div>
  );
}
