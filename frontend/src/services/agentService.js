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

  // Chat with agent
  async chat(message, mandateToken, context = {}) {
    const response = await api.post('/agent/chat', {
      message,
      mandateToken,
      context,
    });
    return response.data.data;
  },

  // Get activity log
  async getActivity(params = {}) {
    const response = await api.get('/agent/activity', { params });
    return response.data;
  },
};

export default agentService;
