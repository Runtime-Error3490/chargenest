import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '../services/agentService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import Modal from '../components/ui/Modal';

// Mandate levels with descriptions
const MANDATE_LEVELS = [
  {
    level: 0,
    name: 'Off',
    description: 'AI agent is completely disabled. No autonomous actions.',
    actions: [],
  },
  {
    level: 1,
    name: 'Inform Only',
    description: 'AI can only provide information and suggestions. No actions taken.',
    actions: ['Search chargers', 'Answer questions', 'Provide recommendations'],
  },
  {
    level: 2,
    name: 'Ask First',
    description: 'AI requires your approval before taking any action.',
    actions: ['All Level 1 actions', 'Book chargers (with approval)', 'Cancel bookings (with approval)', 'Submit disputes (with approval)'],
  },
  {
    level: 3,
    name: 'Act & Report',
    description: 'AI can take routine actions automatically and reports back.',
    actions: ['All Level 2 actions', 'Auto-book within budget', 'Auto-cancel free cancellations', 'Report after action'],
  },
  {
    level: 4,
    name: 'Full Autonomy',
    description: 'AI handles all booking operations with minimal oversight.',
    actions: ['All Level 3 actions', 'Make payments within limit', 'Handle disputes automatically', 'Manage charger preferences'],
  },
];

// Action categories for fine-grained control
const ACTION_CATEGORIES = [
  {
    id: 'search',
    name: 'Search & Discovery',
    actions: [
      { id: 'search_chargers', name: 'Search for chargers', defaultLevel: 1 },
      { id: 'view_charger', name: 'View charger details', defaultLevel: 1 },
      { id: 'compare_prices', name: 'Compare prices', defaultLevel: 1 },
    ],
  },
  {
    id: 'booking',
    name: 'Booking Management',
    actions: [
      { id: 'create_booking', name: 'Create bookings', defaultLevel: 2 },
      { id: 'modify_booking', name: 'Modify bookings', defaultLevel: 2 },
      { id: 'cancel_booking', name: 'Cancel bookings', defaultLevel: 2 },
      { id: 'start_session', name: 'Start charging session', defaultLevel: 3 },
    ],
  },
  {
    id: 'payment',
    name: 'Payment & Billing',
    actions: [
      { id: 'view_payment', name: 'View payment history', defaultLevel: 1 },
      { id: 'make_payment', name: 'Make payments', defaultLevel: 2 },
      { id: 'top_up_wallet', name: 'Create wallet top-up links', defaultLevel: 2 },
      { id: 'create_invoice', name: 'Send damage invoices (always asks you)', defaultLevel: 3 },
      { id: 'request_refund', name: 'Request refunds', defaultLevel: 2 },
    ],
  },
  {
    id: 'dispute',
    name: 'Disputes & Support',
    actions: [
      { id: 'create_dispute', name: 'Create disputes', defaultLevel: 2 },
      { id: 'respond_dispute', name: 'Respond to disputes', defaultLevel: 2 },
      { id: 'accept_resolution', name: 'Accept resolutions', defaultLevel: 3 },
    ],
  },
];

export default function AgentSettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Settings state
  const [mandateLevel, setMandateLevel] = useState(2);
  const [customPermissions, setCustomPermissions] = useState({});
  const [spendingLimit, setSpendingLimit] = useState(5000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingLevel, setPendingLevel] = useState(null);

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [spentThisMonth, setSpentThisMonth] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/settings/agent' } });
      return;
    }

    const fetchSettings = async () => {
      try {
        setLoading(true);
        
        // Fetch current mandate settings
        const settings = await agentService.getSettings();
        setMandateLevel(settings.level ?? 2);
        setCustomPermissions(settings.permissions || {});
        setSpendingLimit(settings.spendingLimit || 0);
        setSpentThisMonth(settings.spentThisMonth || 0);

        // KYA identity card and recent agent actions
        setIdentity(await agentService.getIdentity());
        const logResponse = await agentService.getActivity({ limit: 10 });
        setAuditLog(logResponse.data || []);
        
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [isAuthenticated, navigate]);

  const handleLevelChange = (level) => {
    if (level > mandateLevel) {
      // Increasing autonomy - confirm first
      setPendingLevel(level);
      setShowConfirmModal(true);
    } else {
      setMandateLevel(level);
    }
  };

  const confirmLevelChange = () => {
    setMandateLevel(pendingLevel);
    setShowConfirmModal(false);
    setPendingLevel(null);
  };

  const togglePermission = (actionId) => {
    setCustomPermissions(prev => ({
      ...prev,
      [actionId]: !prev[actionId],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await agentService.updateSettings({
        level: mandateLevel,
        permissions: customPermissions,
        spendingLimit: spendingLimit,
      });

      setSuccess('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  const currentLevel = MANDATE_LEVELS.find(l => l.level === mandateLevel);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agent Settings</h1>
            <p className="text-gray-600 mt-1">
              Configure your AI concierge's autonomy level and permissions
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/chat')}>
            Chat with Agent
          </Button>
        </div>

        {/* KYA identity card */}
        <Card className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🛡️</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-green-900">Know Your Agent (KYA)</h3>
                {identity && (
                  <Badge variant={identity.kyaVerified ? 'success' : 'warning'}>
                    {identity.kyaVerified ? 'Verified' : 'Not verified'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-green-800 mt-1">
                Your agent has its own identity, linked to your account. Every action it takes is signed
                with its key and checked against the permissions you set here.
              </p>
              {identity && (
                <dl className="mt-3 text-xs text-green-900 space-y-1">
                  <div className="flex gap-2"><dt className="font-medium">Agent ID:</dt><dd className="font-mono truncate">{identity.agentId}</dd></div>
                  <div className="flex gap-2"><dt className="font-medium">Model:</dt><dd>{identity.provider} / {identity.model}</dd></div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Object.entries(identity.checks || {}).map(([check, ok]) => (
                      <span key={check} className={`px-2 py-0.5 rounded ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {ok ? '✓' : '✕'} {check}
                      </span>
                    ))}
                  </div>
                </dl>
              )}
            </div>
          </div>
        </Card>

        {/* Mandate Level Selection */}
        <Card className="mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Autonomy Level</h2>
          
          <div className="space-y-3">
            {MANDATE_LEVELS.map((level) => (
              <button
                key={level.level}
                onClick={() => handleLevelChange(level.level)}
                className={`w-full text-left p-6 rounded-lg border-2 transition-all ${
                  mandateLevel === level.level
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      mandateLevel === level.level
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {level.level}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{level.name}</h3>
                      <p className="text-sm text-gray-600">{level.description}</p>
                    </div>
                  </div>
                  {mandateLevel === level.level && (
                    <Badge variant="success">Active</Badge>
                  )}
                </div>
                
                {level.actions.length > 0 && mandateLevel === level.level && (
                  <div className="mt-3 pl-13">
                    <p className="text-xs text-gray-500 mb-2">Enabled actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {level.actions.map((action, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Spending Limit */}
        {mandateLevel >= 3 && (
          <Card className="mb-6 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending Limit</h2>
            <p className="text-sm text-gray-600 mb-4">
              Most the AI can spend each month. Spent this month: ₹{spentThisMonth.toLocaleString()}. Zero means no limit.
            </p>
            
            <div className="flex items-center gap-4">
              <span className="text-gray-600">₹</span>
              <input
                type="number"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                min="0"
                step="500"
              />
              <span className="text-gray-600">per month</span>
            </div>

            <div className="mt-4 flex gap-2">
              {[1000, 2500, 5000, 10000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setSpendingLimit(amount)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    spendingLimit === amount
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ₹{amount.toLocaleString()}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Advanced Permissions */}
        <Card className="mb-6 p-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-lg font-semibold text-gray-900">Advanced Permissions</h2>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="mt-6 space-y-6">
              {ACTION_CATEGORIES.map(category => (
                <div key={category.id}>
                  <h3 className="font-medium text-gray-900 mb-3">{category.name}</h3>
                  <div className="space-y-2">
                    {category.actions.map(action => {
                      const isEnabled = customPermissions[action.id] ?? (mandateLevel >= action.defaultLevel);
                      
                      return (
                        <label
                          key={action.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                        >
                          <div>
                            <span className="text-gray-900">{action.name}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              (Default: Level {action.defaultLevel}+)
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => togglePermission(action.id)}
                              className="sr-only"
                            />
                            <div className={`w-11 h-6 rounded-full transition-colors ${
                              isEnabled ? 'bg-green-600' : 'bg-gray-300'
                            }`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                                isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                              } mt-0.5`} />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Save Button */}
        {/* Shown here, next to the button, because the page is long and the top is off screen */}
        {error && (
          <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="p-4 bg-green-50 text-green-700 rounded-lg mb-4">
            {success}
          </div>
        )}
        <div className="flex justify-end gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loading size="sm" /> : 'Save Settings'}
          </Button>
        </div>

        {/* Recent Activity */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Agent Activity</h2>
          
          {auditLog.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {auditLog.slice(0, 10).map((entry, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.status === 'success' ? 'bg-green-100 text-green-600' :
                    entry.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {entry.status === 'success' ? '✓' : entry.status === 'pending' ? '⏳' : '✕'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900">{entry.action}</p>
                    <p className="text-sm text-gray-600 truncate">{entry.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </div>
                  <Badge size="sm" variant={
                    entry.approvalRequired ? 'warning' : 'default'
                  }>
                    {entry.approvalRequired ? 'Manual' : 'Auto'}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {auditLog.length > 10 && (
            <button
              className="w-full mt-4 text-center text-green-600 hover:text-green-700 text-sm font-medium"
            >
              View All Activity
            </button>
          )}
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingLevel(null);
        }}
        title="Increase Agent Autonomy?"
      >
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p className="text-yellow-800">
              You're about to increase your AI agent's autonomy level from{' '}
              <strong>{currentLevel?.name}</strong> to{' '}
              <strong>{MANDATE_LEVELS.find(l => l.level === pendingLevel)?.name}</strong>.
            </p>
          </div>

          <p className="text-gray-600">
            At this level, the AI agent will be able to:
          </p>
          
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            {MANDATE_LEVELS.find(l => l.level === pendingLevel)?.actions.map((action, idx) => (
              <li key={idx}>{action}</li>
            ))}
          </ul>

          <p className="text-sm text-gray-500">
            You can change this setting at any time. All actions will be logged for your review.
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowConfirmModal(false);
                setPendingLevel(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={confirmLevelChange}
            >
              Confirm Change
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
