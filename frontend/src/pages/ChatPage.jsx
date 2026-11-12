import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { agentService } from '../services/agentService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Loading from '../components/ui/Loading';
import Badge from '../components/ui/Badge';
import { getBrowserLocation } from '../utils/location';
import {
  Bot,
  Settings,
  Send,
  Sparkles,
  MapPin,
  Calendar,
  XCircle,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  CheckCircle,
  X,
  MessageCircle
} from 'lucide-react';

// Quick action suggestions with icons, by account type. A host-only account never sees driver actions.
const DRIVER_ACTIONS = [
  { label: 'Find nearby chargers', message: 'Help me find chargers near my location', icon: MapPin, color: 'from-blue-500 to-blue-600' },
  { label: 'My bookings', message: 'Show me my upcoming bookings', icon: Calendar, color: 'from-purple-500 to-purple-600' },
  { label: 'Cancel booking', message: 'I need to cancel a booking', icon: XCircle, color: 'from-red-500 to-red-600' },
  { label: 'Report issue', message: 'I want to report an issue with my charging session', icon: AlertTriangle, color: 'from-orange-500 to-orange-600' },
  { label: 'Refund status', message: 'What is the status of my refund?', icon: RefreshCw, color: 'from-green-500 to-green-600' },
  { label: 'How does it work?', message: 'Explain how this platform works', icon: HelpCircle, color: 'from-indigo-500 to-indigo-600' },
];

const HOST_ACTIONS = [
  { label: 'Bookings on my chargers', message: 'Show the bookings on my chargers', icon: Calendar, color: 'from-purple-500 to-purple-600' },
  { label: 'My earnings', message: 'What is my wallet balance and what are my pending earnings?', icon: RefreshCw, color: 'from-green-500 to-green-600' },
  { label: 'Send a damage invoice', message: 'I want to send a damage invoice for a finished booking', icon: AlertTriangle, color: 'from-orange-500 to-orange-600' },
  { label: 'My disputes', message: 'Show my disputes', icon: XCircle, color: 'from-red-500 to-red-600' },
  { label: 'Check a charger device', message: 'Check the device status for a booking on my charger', icon: MapPin, color: 'from-blue-500 to-blue-600' },
  { label: 'How does it work?', message: 'Explain how hosting works on this platform', icon: HelpCircle, color: 'from-indigo-500 to-indigo-600' },
];

function actionsFor(user) {
  const roles = user?.roles || [];
  const driver = roles.includes('driver');
  const host = roles.includes('host');
  if (driver && host) {
    // Both roles: the driver set, plus the host actions that driver does not have
    return [...DRIVER_ACTIONS.slice(0, 3), HOST_ACTIONS[0], HOST_ACTIONS[2], DRIVER_ACTIONS[5]];
  }
  if (host) return HOST_ACTIONS;
  return DRIVER_ACTIONS;
}

// What each approval is, in plain words
const APPROVAL_TITLES = {
  create_booking: 'Book a charger',
  raise_dispute: 'Raise a dispute',
  create_damage_invoice: 'Send a damage invoice',
  cancel_booking: 'Cancel a booking',
  top_up_wallet: 'Add money to your wallet',
};

// The server's role error, in words a user can act on
function friendlyError(err) {
  const text = String(err?.message || '');
  if (/requires one of these roles|forbidden/i.test(text)) {
    return "The AI Concierge isn't available for this account type. Use a driver or host account, or email support from the Support page.";
  }
  return text || "I'm sorry, I encountered an error. Please try again.";
}

// Styles for the assistant's markdown. Raw HTML in a reply is not rendered.
const markdownComponents = {
  p: (props) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => <a className="text-green-600 dark:text-green-400 underline" target="_blank" rel="noopener noreferrer" {...props} />,
  code: (props) => <code className="bg-gray-100 dark:bg-gray-700 rounded px-1 text-sm" {...props} />,
  h1: (props) => <h3 className="font-semibold text-lg mb-2" {...props} />,
  h2: (props) => <h3 className="font-semibold text-lg mb-2" {...props} />,
  h3: (props) => <h3 className="font-semibold mb-1" {...props} />,
};

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const messagesEndRef = useRef(null);
  const approving = useRef(new Set()); // approval ids being sent right now
  const inputRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [replying, setReplying] = useState(false); // true once the reply text starts arriving
  const [agentStatus, setAgentStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Initial greeting
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! 👋 I'm your EV charging assistant. I can help you with:

${(user?.roles || []).includes('host') && !(user?.roles || []).includes('driver')
  ? `• Bookings on your chargers
• Your wallet and earnings
• Damage invoices and disputes
• Understanding platform features`
  : `• Finding and booking chargers
• Managing your bookings
• Reporting issues and disputes
• Understanding platform features`}

How can I help you today?`,
      timestamp: new Date(),
    }]);
  }, [user]);

  // Fetch agent status
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAgentStatus = async () => {
      try {
        setAgentStatus(await agentService.getStatus());
        setPendingApprovals(await agentService.getApprovals());
      } catch (err) {
        console.error('Failed to fetch agent status:', err);
      }
    };

    fetchAgentStatus();
  }, [isAuthenticated]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pendingApprovals.length]);

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    const replyId = (Date.now() + 1).toString();
    let streamed = false;
    try {
      // Real browser location if the user allowed it; the backend adds it to the message
      const loc = await getBrowserLocation();
      const context = loc ? { currentLocation: { latitude: loc.latitude, longitude: loc.longitude } } : {};
      // Earlier turns, so the agent remembers what was said (no welcome text, no errors)
      context.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      context.history = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.id !== 'welcome' && !m.isError && m.content)
        .slice(-20)
        .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
      // Real charger and package ids seen so far (newest win), sent as data, not inside the replies
      const seen = new Map();
      messages.forEach(m => (m.refs || []).forEach(r => seen.set(r.chargerId, r)));
      context.refs = [...seen.values()].slice(-8);
      const data = await agentService.chatStream(content.trim(), undefined, context, {
        onText: (text) => {
          setStatus('');
          setReplying(true);
          const hasReply = streamed;
          streamed = true;
          setMessages(prev => hasReply
            ? prev.map(m => (m.id === replyId ? { ...m, content: m.content + text } : m))
            : [...prev, { id: replyId, role: 'assistant', content: text, timestamp: new Date() }]);
        },
        onStatus: setStatus,
      });

      const assistantMessage = {
        id: replyId,
        role: 'assistant',
        content: data.message,
        refs: data.refs,
        timestamp: new Date(),
      };

      const wasStreamed = streamed;
      setMessages(prev => (wasStreamed
        ? prev.map(m => (m.id === replyId ? assistantMessage : m))
        : [...prev, assistantMessage]));

      if (data.pendingApprovals?.length) {
        setPendingApprovals(prev => [
          ...prev,
          ...data.pendingApprovals.filter(a => !prev.some(p => p.id === a.id)),
        ]);
      }
    } catch (err) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: friendlyError(err),
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStatus('');
      setReplying(false);
      inputRef.current?.focus();
    }
  };

  const handleApproval = async (approvalId, approved) => {
    // One click only: ignore a second click while this one is being sent
    if (approving.current.has(approvalId)) return;
    approving.current.add(approvalId);
    // The box goes away at once; the "working" bubble above the input shows progress
    setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    setStatus(approved ? 'Carrying that out...' : 'Cancelling...');
    try {
      setLoading(true);
      const result = await agentService.respondToApproval(approvalId, approved);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: approved
          ? (result.message || 'Done. The action has been completed.')
          : "Action cancelled. Let me know if there's anything else I can help with.",
        timestamp: new Date(),
        isError: approved && result.status === 'failed',
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: err.message || 'Could not complete that action.',
        timestamp: new Date(),
        isError: true,
      }]);
    } finally {
      approving.current.delete(approvalId);
      setStatus('');
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-16 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-xl text-gray-900 dark:text-white">AI Concierge</h1>
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {agentStatus?.isActive ? (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Standby
                    </span>
                  )}
                  {agentStatus?.mandateLevel > 0 && (
                    <Badge variant="primary" className="text-xs">
                      Level {agentStatus.mandateLevel}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/agent')}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-4 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20'
                    : message.isError
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                    : 'bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                {message.role === 'assistant' && !message.isError ? (
                  <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
                
                <p className={`text-xs mt-3 ${
                  message.role === 'user' ? 'text-green-200' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ml-3 flex-shrink-0 mt-1">
                  <span className="text-white font-semibold text-sm">
                    {user?.name?.[0] || 'U'}
                  </span>
                </div>
              )}
            </div>
          ))}

          {loading && (!replying || status) && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3 flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">{status || 'Thinking...'}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              Quick actions
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {actionsFor(user).map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={() => sendMessage(action.message)}
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-md group"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Approvals and input stick to the bottom together, so Approve is always in view */}
      <div className="sticky bottom-0 z-40">
      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-10px_30px_rgba(0,0,0,0.18)] max-h-[50vh] overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Needs your approval
              {pendingApprovals.length > 1 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  {pendingApprovals.length}
                </span>
              )}
            </p>
            {pendingApprovals.map(approval => (
              <div
                key={approval.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-300/70 dark:border-amber-500/40 border-l-4 border-l-amber-500 bg-amber-50/60 dark:bg-amber-900/10 p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {APPROVAL_TITLES[approval.action] || approval.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-100 mt-1 break-words">{approval.description}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproval(approval.id, false)}
                    className="flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproval(approval.id, true)}
                    className="flex items-center gap-1 bg-gradient-to-r from-green-500 to-emerald-600"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows={1}
                className="w-full resize-none rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-green-500 dark:focus:border-green-400 focus:ring-0 py-3.5 px-4 pr-12 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                disabled={loading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <MessageCircle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
            <Button
              onClick={() => sendMessage(inputValue)}
              disabled={loading || !inputValue.trim()}
              className="px-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25 disabled:shadow-none"
            >
              {loading ? (
                <Loading size="sm" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            AI responses are generated. Not solved?{' '}
            <Link to="/support" className="underline text-green-600 dark:text-green-400" style={{ minHeight: 'auto', minWidth: 'auto' }}>
              Email human support
            </Link>.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
