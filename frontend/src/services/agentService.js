import api from './api';

export const agentService = {
  // Create mandate
  async createMandate(data = {}) {
    const response = await api.post('/agent/mandates', data);
    return response.data.data.mandate;
  },

  // Get user's mandates
  async getMandates(includeExpired = false) {
    const response = await api.get('/agent/mandates', {
      params: { includeExpired },
    });
    return response.data.data.mandates;
  },

  // Revoke mandate
  async revokeMandate(id) {
    const response = await api.delete(`/agent/mandates/${id}`);
    return response.data;
  },

  // Chat with agent. Returns { message, requiresApproval, pendingApprovals, ... }
  async chat(message, mandateToken, context = {}) {
    const response = await api.post('/agent/chat', {
      message,
      mandateToken,
      context,
    });
    return response.data.data;
  },

  // Same result as chat(), but onText(delta) is called as the reply is written and
  // onStatus(text) while tools run. If streaming is off or fails before anything arrives,
  // it quietly uses chat(). Turn it off with VITE_AI_STREAMING=false.
  async chatStream(message, mandateToken, context = {}, { onText, onStatus } = {}) {
    if (import.meta.env.VITE_AI_STREAMING === 'false') {
      return this.chat(message, mandateToken, context);
    }

    let gotEvent = false;
    try {
      const { useAuthStore } = await import('../store/authStore');
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${api.defaults.baseURL}/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message, mandateToken, context }),
      });
      if (!response.ok || !response.body) throw new Error(`stream unavailable (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop();
        for (const block of blocks) {
          const event = /^event: (.*)$/m.exec(block)?.[1];
          const raw = /^data: (.*)$/m.exec(block)?.[1];
          if (!event || !raw) continue;
          const data = JSON.parse(raw);
          gotEvent = true;
          if (event === 'text') onText?.(data.text);
          else if (event === 'tool_start') onStatus?.(`Using ${data.name.replace(/_/g, ' ')}...`);
          else if (event === 'tool_result') onStatus?.('');
          else if (event === 'done') result = data;
          else if (event === 'error') throw new Error(data.message);
        }
      }
      if (!result) throw new Error('The reply was cut off. Please try again.');
      return result;
    } catch (err) {
      // Nothing reached the user yet, so the normal call is safe to try
      if (!gotEvent) return this.chat(message, mandateToken, context);
      throw err;
    }
  },

  // Get activity log (paginated response: { data: [...], pagination })
  async getActivity(params = {}) {
    const response = await api.get('/agent/activity', { params });
    return response.data;
  },

  // { isActive, mandateLevel, agentId, provider, model }
  async getStatus() {
    const response = await api.get('/agent/status');
    return response.data.data;
  },

  // { level, permissions, spendingLimit, agentId, spentThisMonth }
  async getSettings() {
    const response = await api.get('/agent/settings');
    return response.data.data;
  },

  async updateSettings(settings) {
    const response = await api.put('/agent/settings', settings);
    return response.data.data;
  },

  // KYA identity card
  async getIdentity() {
    const response = await api.get('/agent/identity');
    return response.data.data;
  },

  // Actions the agent is waiting on the owner to confirm
  async getApprovals() {
    const response = await api.get('/agent/approvals');
    return response.data.data;
  },

  async getApproval(id) {
    const response = await api.get(`/agent/approvals/${id}`);
    return response.data.data;
  },

  async respondToApproval(id, approved) {
    const response = await api.post(`/agent/approvals/${id}/respond`, { approved });
    return response.data.data;
  },
};

export default agentService;
