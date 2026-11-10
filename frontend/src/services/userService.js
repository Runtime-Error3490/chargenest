import api from './api';

export const userService = {
  // Get profile
  async getProfile() {
    const response = await api.get('/users/profile');
    return response.data.data.user;
  },

  // Update profile
  async updateProfile(data) {
    const response = await api.put('/users/profile', data);
    return response.data.data.user;
  },

  // Add role
  async addRole(role) {
    const response = await api.post('/users/roles', { role });
    return response.data.data;
  },

  // Get dashboard stats
  async getDashboard() {
    const response = await api.get('/users/dashboard');
    return response.data.data;
  },

  // Get user stats (for driver dashboard)
  async getUserStats() {
    try {
      const response = await api.get('/users/stats');
      return response.data;
    } catch (err) {
      // Return default stats if endpoint doesn't exist
      return {
        data: {
          totalBookings: 0,
          activeBookings: 0,
          totalSpent: 0,
          savedCO2: 0,
        }
      };
    }
  },

  // Get host stats (for host dashboard)
  async getHostStats() {
    try {
      const response = await api.get('/users/host/stats');
      return response.data;
    } catch (err) {
      // Return default stats if endpoint doesn't exist
      return {
        data: {
          totalEarnings: 0,
          pendingPayout: 0,
          totalBookings: 0,
          activeChargers: 0,
          averageRating: 0,
        }
      };
    }
  },

  // Get public profile
  async getPublicProfile(id) {
    const response = await api.get(`/users/${id}/public`);
    return response.data.data.user;
  },

  // Get payments history
  async getPayments(params = {}) {
    const response = await api.get('/payments', { params });
    return response.data;
  },
};

export default userService;
