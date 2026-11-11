import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '../services/agentService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import Modal from '../components/ui/Modal';
import {
  Bot,
  MessageCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  ZapOff,
  Eye,
  MessageSquare,
  CheckCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  DollarSign,
  Search,
  Calendar,
  CreditCard,
  AlertTriangle,
  Clock,
  Activity,
  Settings,
  ArrowLeft
} from 'lucide-react';

// Mandate levels with descriptions and icons
const MANDATE_LEVELS = [
  {
    level: 0,
    name: 'Off',
    description: 'AI agent is completely disabled. No autonomous actions.',
    actions: [],
    icon: ZapOff,
    color: 'from-gray-400 to-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  {
    level: 1,
    name: 'Inform Only',
    description: 'AI can only provide information and suggestions. No actions taken.',
    actions: ['Search chargers', 'Answer questions', 'Provide recommendations'],
    icon: Eye,
    color: 'from-blue-400 to-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    level: 2,
    name: 'Ask First',
    description: 'AI requires your approval before taking any action.',
    actions: ['All Level 1 actions', 'Book chargers (with approval)', 'Cancel bookings (with approval)', 'Submit disputes (with approval)'],
    icon: MessageSquare,
    color: 'from-purple-400 to-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    level: 3,
    name: 'Act & Report',
    description: 'AI can take routine actions automatically and reports back.',
    actions: ['All Level 2 actions', 'Auto-book within budget', 'Auto-cancel free cancellations', 'Report after action'],
    icon: Zap,
    color: 'from-orange-400 to-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  {
    level: 4,
    name: 'Full Autonomy',
    description: 'AI handles all booking operations with minimal oversight.',
    actions: ['All Level 3 actions', 'Make payments within limit', 'Handle disputes automatically', 'Manage charger preferences'],
    icon: Sparkles,
    color: 'from-green-400 to-emerald-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
];

// Action categories for fine-grained control with icons
const ACTION_CATEGORIES = [
  {
    id: 'search',
    name: 'Search & Discovery',
    icon: Search,
    color: 'text-blue-500',
    actions: [
      { id: 'search_chargers', name: 'Search for chargers', defaultLevel: 1 },
      { id: 'view_charger', name: 'View charger details', defaultLevel: 1 },
      { id: 'compare_prices', name: 'Compare prices', defaultLevel: 1 },
    ],
  },
  {
    id: 'booking',
    name: 'Booking Management',
    icon: Calendar,
    color: 'text-purple-500',
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
    icon: CreditCard,
    color: 'text-green-500',
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
    icon: AlertTriangle,
    color: 'text-orange-500',
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
        
        const settings = await agentService.getSettings();
        setMandateLevel(settings.level ?? 2);
        setCustomPermissions(settings.permissions || {});
        setSpendingLimit(settings.spendingLimit || 0);
        setSpentThisMonth(settings.spentThisMonth || 0);

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
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  const currentLevel = MANDATE_LEVELS.find(l => l.level === mandateLevel);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Agent Settings</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                Configure your AI concierge's autonomy and permissions
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/chat')} className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Chat with Agent
          </Button>
        </div>

        {/* KYA identity card */}
        <Card className="mb-6 overflow-hidden dark:bg-gray-800">
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-600"></div>
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Know Your Agent (KYA)</h3>
                  {identity && (
                    <Badge variant={identity.kyaVerified ? 'success' : 'warning'}>
                      {identity.kyaVerified ? '✓ Verified' : 'Not verified'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your agent has its own identity, linked to your account. Every action it takes is signed
                  with its key and checked against the permissions you set here.
                </p>
                {identity && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Agent ID</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white truncate">{identity.agentId}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Model</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{identity.provider} / {identity.model}</p>
                    </div>
                  </div>
                )}
                {identity?.checks && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(identity.checks).map(([check, ok]) => (
                      <span key={check} className={`px-3 py-1 rounded-full text-xs font-medium ${ok ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                        {ok ? '✓' : '✕'} {check}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Mandate Level Selection */}
        <Card className="mb-6 dark:bg-gray-800 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Autonomy Level</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Choose how much control your AI has</p>
                </div>
              </div>
              {currentLevel && (
                <div className={`px-4 py-2 rounded-xl bg-gradient-to-r ${currentLevel.color} text-white font-semibold text-sm shadow-lg`}>
                  Currently: {currentLevel.name}
                </div>
              )}
            </div>

            {/* Level Slider Visual */}
            <div className="mb-8">
              <div className="relative">
                {/* Background track */}
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-gray-400 via-blue-500 via-purple-500 via-orange-500 to-green-500 transition-all duration-500"
                    style={{ width: `${(mandateLevel / 4) * 100}%` }}
                  ></div>
                </div>
                {/* Level dots */}
                <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-0">
                  {MANDATE_LEVELS.map((level) => {
                    const isActive = mandateLevel >= level.level;
                    const isCurrent = mandateLevel === level.level;
                    return (
                      <button
                        key={level.level}
                        onClick={() => handleLevelChange(level.level)}
                        className={`
                          w-7 h-7 rounded-full border-4 transition-all duration-300 transform
                          ${isCurrent 
                            ? `bg-gradient-to-r ${level.color} border-white dark:border-gray-800 scale-125 shadow-lg ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-opacity-50 ${level.level === 0 ? 'ring-gray-400' : level.level === 1 ? 'ring-blue-400' : level.level === 2 ? 'ring-purple-400' : level.level === 3 ? 'ring-orange-400' : 'ring-green-400'}`
                            : isActive
                            ? `bg-gradient-to-r ${level.color} border-white dark:border-gray-800`
                            : 'bg-gray-300 dark:bg-gray-600 border-white dark:border-gray-800 hover:scale-110'
                          }
                        `}
                      />
                    );
                  })}
                </div>
              </div>
              {/* Level labels */}
              <div className="flex justify-between mt-4">
                {MANDATE_LEVELS.map((level) => (
                  <div 
                    key={level.level} 
                    className={`text-center transition-all ${mandateLevel === level.level ? 'scale-110' : ''}`}
                    style={{ width: '20%' }}
                  >
                    <p className={`text-xs font-bold ${mandateLevel === level.level ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {level.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Level Cards */}
            <div className="grid gap-3">
              {MANDATE_LEVELS.map((level) => {
                const Icon = level.icon;
                const isSelected = mandateLevel === level.level;
                
                return (
                  <button
                    key={level.level}
                    onClick={() => handleLevelChange(level.level)}
                    className={`
                      w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 group
                      ${isSelected
                        ? `border-transparent bg-gradient-to-r ${level.color} shadow-xl scale-[1.02]`
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:scale-[1.01] bg-white dark:bg-gray-800/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`
                        w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                        ${isSelected 
                          ? 'bg-white/20 shadow-inner' 
                          : `bg-gradient-to-br ${level.color} shadow-lg group-hover:scale-110`
                        }
                      `}>
                        <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-white'}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className={`
                            text-xs font-black px-2.5 py-1 rounded-lg
                            ${isSelected 
                              ? 'bg-white/20 text-white' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }
                          `}>
                            LEVEL {level.level}
                          </span>
                          <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                            {level.name}
                          </h3>
                          {isSelected && (
                            <div className="ml-auto flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                              <CheckCircle className="w-4 h-4 text-white" />
                              <span className="text-white text-sm font-semibold">Active</span>
                            </div>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${isSelected ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
                          {level.description}
                        </p>
                      </div>

                      {/* Arrow indicator */}
                      {!isSelected && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center`}>
                            <ChevronRight className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Enabled actions - shown when selected */}
                    {level.actions.length > 0 && isSelected && (
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <p className="text-xs font-semibold text-white/70 mb-3 uppercase tracking-wide">What your AI can do:</p>
                        <div className="flex flex-wrap gap-2">
                          {level.actions.map((action, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm font-medium"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Trust indicator */}
            <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentLevel?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`}>
                    {currentLevel?.level === 0 ? <ShieldAlert className="w-5 h-5 text-white" /> : <ShieldCheck className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Trust Level</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {mandateLevel === 0 && "Your AI is disabled"}
                      {mandateLevel === 1 && "Your AI can only inform you"}
                      {mandateLevel === 2 && "Your AI asks before acting"}
                      {mandateLevel === 3 && "Your AI acts and reports back"}
                      {mandateLevel === 4 && "Your AI has full autonomy"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-3 h-8 rounded-full transition-all ${
                        i <= mandateLevel 
                          ? `bg-gradient-to-t ${currentLevel?.color || 'from-gray-400 to-gray-500'}` 
                          : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Spending Limit */}
        {mandateLevel >= 3 && (
          <Card className="mb-6 dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Spending Limit</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Spent this month: <span className="font-semibold text-green-600 dark:text-green-400">${spentThisMonth.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={spendingLimit}
                    onChange={(e) => setSpendingLimit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-green-500 dark:focus:border-green-400 focus:ring-0 transition-colors"
                    min="0"
                    step="500"
                  />
                </div>
                <span className="text-gray-500 dark:text-gray-400 font-medium">per month</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {[500, 1000, 2500, 5000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setSpendingLimit(amount)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      spendingLimit === amount
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    ${amount.toLocaleString()}
                  </button>
                ))}
                <button
                  onClick={() => setSpendingLimit(0)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    spendingLimit === 0
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  No limit
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Advanced Permissions */}
        <Card className="mb-6 dark:bg-gray-800">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Advanced Permissions</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fine-tune individual action permissions</p>
              </div>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 space-y-6">
              {ACTION_CATEGORIES.map(category => {
                const CategoryIcon = category.icon;
                return (
                  <div key={category.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <CategoryIcon className={`w-5 h-5 ${category.color}`} />
                      <h3 className="font-semibold text-gray-900 dark:text-white">{category.name}</h3>
                    </div>
                    <div className="space-y-2">
                      {category.actions.map(action => {
                        const isEnabled = customPermissions[action.id] ?? (mandateLevel >= action.defaultLevel);
                        
                        return (
                          <label
                            key={action.id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl cursor-pointer hover:shadow-sm transition-shadow"
                          >
                            <div>
                              <span className="text-gray-900 dark:text-white font-medium">{action.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                (Default: L{action.defaultLevel}+)
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => togglePermission(action.id)}
                                className="sr-only"
                              />
                              <div className={`w-11 h-6 rounded-full transition-colors flex items-center ${
                                isEnabled ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                              }`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                                  isEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                                }`} />
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Save Button */}
        {error && (
          <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl mb-4 flex items-center gap-3 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl mb-4 flex items-center gap-3 border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}
        <div className="flex justify-end gap-4 mb-8">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
            {saving ? <Loading size="sm" /> : <CheckCircle className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>

        {/* Recent Activity */}
        <Card className="dark:bg-gray-800">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Agent Activity</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Track what your AI has been doing</p>
              </div>
            </div>
            
            {auditLog.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLog.slice(0, 10).map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:shadow-sm transition-shadow"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      entry.status === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                      entry.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                      'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {entry.status === 'success' ? <CheckCircle className="w-5 h-5" /> : 
                       entry.status === 'pending' ? <Clock className="w-5 h-5" /> : 
                       <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">{entry.action}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{entry.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(entry.timestamp)}
                      </p>
                    </div>
                    <Badge size="sm" variant={entry.approvalRequired ? 'warning' : 'default'}>
                      {entry.approvalRequired ? 'Manual' : 'Auto'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {auditLog.length > 10 && (
              <button className="w-full mt-4 py-3 text-center text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-semibold rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                View All Activity
              </button>
            )}
          </div>
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
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                You're increasing autonomy from{' '}
                <strong>{currentLevel?.name}</strong> to{' '}
                <strong>{MANDATE_LEVELS.find(l => l.level === pendingLevel)?.name}</strong>.
              </p>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            At this level, the AI agent will be able to:
          </p>
          
          <ul className="space-y-2">
            {MANDATE_LEVELS.find(l => l.level === pendingLevel)?.actions.map((action, idx) => (
              <li key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {action}
              </li>
            ))}
          </ul>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            You can change this setting at any time. All actions will be logged for your review.
          </p>

          <div className="flex gap-3 pt-2">
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
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600"
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
