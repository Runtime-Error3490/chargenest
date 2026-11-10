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
