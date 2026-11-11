import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { agentService } from '../services/agentService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Loading from '../components/ui/Loading';
import Badge from '../components/ui/Badge';

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: 'Find nearby chargers', message: 'Help me find chargers near my location' },
  { label: 'My bookings', message: 'Show me my upcoming bookings' },
  { label: 'Cancel booking', message: 'I need to cancel a booking' },
  { label: 'Report issue', message: 'I want to report an issue with my charging session' },
  { label: 'Refund status', message: 'What is the status of my refund?' },
  { label: 'How does it work?', message: 'Explain how this platform works' },
];

// Styles for the assistant's markdown. Raw HTML in a reply is not rendered.
const markdownComponents = {
  p: (props) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => <a className="text-green-700 underline" target="_blank" rel="noopener noreferrer" {...props} />,
  code: (props) => <code className="bg-gray-100 rounded px-1 text-sm" {...props} />,
  h1: (props) => <h3 className="font-semibold text-lg mb-2" {...props} />,
  h2: (props) => <h3 className="font-semibold text-lg mb-2" {...props} />,
  h3: (props) => <h3 className="font-semibold mb-1" {...props} />,
};

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [agentStatus, setAgentStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Initial greeting
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! 👋 I'm your EV charging assistant. I can help you with:

• Finding and booking chargers
• Managing your bookings
• Reporting issues and disputes
• Understanding platform features

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

        // Check for pending approvals
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
  }, [messages]);

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    
    // Add user message
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
      const data = await agentService.chatStream(content.trim(), undefined, {}, {
        onText: (text) => {
          setStatus('');
          // Read the flag now: React runs the updater later, after the flag has changed
          const hasReply = streamed;
          streamed = true;
          setMessages(prev => hasReply
            ? prev.map(m => (m.id === replyId ? { ...m, content: m.content + text } : m))
            : [...prev, { id: replyId, role: 'assistant', content: text, timestamp: new Date() }]);
        },
        onStatus: setStatus,
      });

      // Add the final assistant response (replaces any text that was streamed)
      const assistantMessage = {
        id: replyId,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      const wasStreamed = streamed;
      setMessages(prev => (wasStreamed
        ? prev.map(m => (m.id === replyId ? assistantMessage : m))
        : [...prev, assistantMessage]));

      // The agent needs the owner's confirmation before it acts
      if (data.pendingApprovals?.length) {
        setPendingApprovals(prev => [
          ...prev,
          ...data.pendingApprovals.filter(a => !prev.some(p => p.id === a.id)),
        ]);
      }
    } catch (err) {
      // Add error message
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: err.message || "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStatus('');
      inputRef.current?.focus();
    }
  };

  const handleApproval = async (approvalId, approved) => {
    try {
      setLoading(true);
      // The backend runs the action when the owner approves, and returns the outcome
      const result = await agentService.respondToApproval(approvalId, approved);
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
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
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    } finally {
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b sticky top-16 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">AI Concierge</h1>
                <p className="text-xs text-gray-500">
                  {agentStatus?.isActive ? (
                    <span className="text-green-600">● Active</span>
                  ) : (
                    <span className="text-gray-400">● Standby</span>
                  )}
                  {agentStatus?.mandateLevel > 0 && (
                    <span className="ml-2">Level: {agentStatus.mandateLevel}</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/agent')}
            >
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <p className="text-sm font-medium text-yellow-800 mb-2">
              Actions waiting for your approval:
            </p>
            {pendingApprovals.map(approval => (
              <div
                key={approval.id}
                className="flex items-center justify-between bg-white rounded-lg p-3 mb-2 shadow-sm"
              >
                <div>
                  <Badge size="sm" variant="warning">{approval.action}</Badge>
                  <p className="text-sm text-gray-700 mt-1">{approval.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproval(approval.id, false)}
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproval(approval.id, true)}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-green-600 text-white'
                    : message.isError
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-white shadow-sm border'
                }`}
              >
                {message.role === 'assistant' && !message.isError ? (
                  <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
                
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-green-200' : 'text-gray-400'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loading size="sm" />
                  <span className="text-gray-500 text-sm">{status || 'Thinking...'}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="bg-white border-t">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(action.message)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 resize-none rounded-xl border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4"
              disabled={loading}
            />
            <Button
              onClick={() => sendMessage(inputValue)}
              disabled={loading || !inputValue.trim()}
              className="px-6"
            >
              {loading ? <Loading size="sm" /> : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            AI responses are generated. For critical issues, contact human support.
          </p>
        </div>
      </div>
    </div>
  );
}
