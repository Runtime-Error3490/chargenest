import api from './api';

export const disputeService = {
  // Raise dispute
  async raiseDispute(data) {
    const response = await api.post('/disputes', data);
    return response.data.data;
  },

  // Get user's disputes
  async getDisputes(params = {}) {
    const response = await api.get('/disputes', { params });
    return response.data;
  },

  // Get dispute by ID
  async getDispute(id) {
    const response = await api.get(`/disputes/${id}`);
    return response.data.data.dispute;
  },
};

export default disputeService;
