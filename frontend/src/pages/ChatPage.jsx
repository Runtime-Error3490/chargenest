import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
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
        const response = await agentService.getAgentStatus();
        setAgentStatus(response.data);
        
        // Check for pending approvals
        const approvalsResponse = await agentService.getPendingApprovals();
        setPendingApprovals(approvalsResponse.data || []);
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

    try {
      const response = await agentService.chat({ message: content.trim() });
      
      // Add assistant response
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date(),
        action: response.data.action,
        actionData: response.data.actionData,
        requiresApproval: response.data.requiresApproval,
        confidence: response.data.confidence,
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // If there's a pending approval, add it to the list
      if (response.data.requiresApproval) {
        setPendingApprovals(prev => [...prev, {
          id: response.data.approvalId,
          action: response.data.action,
          description: response.data.actionDescription,
        }]);
      }
    } catch (err) {
      // Add error message
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleApproval = async (approvalId, approved) => {
    try {
      await agentService.respondToApproval(approvalId, { approved });
      
      // Remove from pending
      setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
      
      // Add confirmation message
      const message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: approved 
          ? "Action approved! I'm processing your request now..."
          : "Action cancelled. Let me know if there's anything else I can help with.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, message]);

      // If approved, the action result will come through
      if (approved) {
        setLoading(true);
        // Wait for action result
        setTimeout(async () => {
          try {
            const response = await agentService.getActionResult(approvalId);
            const resultMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: response.data.message || "Done! The action has been completed.",
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, resultMessage]);
          } catch {
            // Silent fail
          } finally {
            setLoading(false);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
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
                  {agentStatus?.mandateLevel && (
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
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {/* Confidence indicator for AI responses */}
                {message.role === 'assistant' && message.confidence && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Confidence: {Math.round(message.confidence * 100)}%
                    </p>
                  </div>
                )}

                {/* Action buttons in assistant messages */}
                {message.action && message.actionData && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {message.action === 'view_charger' && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/chargers/${message.actionData.chargerId}`)}
                      >
                        View Charger
                      </Button>
                    )}
                    {message.action === 'view_booking' && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/bookings/${message.actionData.bookingId}`)}
                      >
                        View Booking
                      </Button>
                    )}
                    {message.action === 'search_chargers' && (
                      <Button
                        size="sm"
                        onClick={() => navigate('/search')}
                      >
                        Browse Chargers
                      </Button>
                    )}
                  </div>
                )}

                {/* Approval request */}
                {message.requiresApproval && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-2">
                      This action requires your approval.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproval(message.actionData?.approvalId, false)}
                      >
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproval(message.actionData?.approvalId, true)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
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
                  <span className="text-gray-500 text-sm">Thinking...</span>
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
