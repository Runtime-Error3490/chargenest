import api from './api';

export const chargerService = {
  // Search chargers
  async searchChargers(params = {}) {
    const response = await api.get('/chargers', { params });
    // Backend returns { success, data: [...chargers], pagination: {...} }
    return {
      data: response.data.data || [],
      pagination: response.data.pagination || {},
    };
  },

  // Get charger by ID
  async getChargerById(id) {
    const response = await api.get(`/chargers/${id}`);
    return {
      data: response.data.data?.charger || response.data.data,
    };
  },

  // Get charger reviews
  async getChargerReviews(id) {
    const response = await api.get(`/chargers/${id}`);
    return {
      data: response.data.data?.charger?.reviews || [],
    };
  },

  // Get host's chargers
  async getMyChargers() {
    const response = await api.get('/chargers/my');
    return {
      data: response.data.data?.chargers || [],
    };
  },

  // Create charger
  async createCharger(data) {
    const response = await api.post('/chargers', data);
    return {
      data: response.data.data,
    };
  },

  // Update charger
  async updateCharger(id, data) {
    const response = await api.put(`/chargers/${id}`, data);
    return {
      data: response.data.data?.charger,
    };
  },

  // Update packages
  async updatePackages(id, packages) {
    const response = await api.put(`/chargers/${id}/packages`, { packages });
    return {
      data: response.data.data?.packages,
    };
  },

  // Update availability
  async updateAvailability(id, availability) {
    const response = await api.put(`/chargers/${id}/availability`, { availability });
    return {
      data: response.data.data?.availability,
    };
  },

  // Delete charger
  async deleteCharger(id) {
    const response = await api.delete(`/chargers/${id}`);
    return response.data;
  },
};

export default chargerService;
