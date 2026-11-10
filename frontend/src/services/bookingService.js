import api from './api';

export const bookingService = {
  // Create booking
  async createBooking(data) {
    const response = await api.post('/bookings', data);
    return response.data.data;
  },

  // Get user's bookings (as a driver)
  async getUserBookings(params = {}) {
    const response = await api.get('/bookings', { params });
    return response.data;
  },

  // Alias for getUserBookings
  async getBookings(params = {}) {
    return this.getUserBookings(params);
  },

  // Get host's bookings (bookings for host's chargers)
  async getHostBookings(params = {}) {
    const response = await api.get('/bookings/host', { params });
    return response.data;
  },

  // Get booking by ID
  async getBooking(id) {
    const response = await api.get(`/bookings/${id}`);
    return response.data.data.booking;
  },

  // Alias for getBooking
  async getBookingById(id) {
    const response = await api.get(`/bookings/${id}`);
    return { data: response.data.data?.booking || response.data.data };
  },

  // Authorize booking (after PayPal approval)
  async authorizeBooking(id) {
    const response = await api.post(`/bookings/${id}/authorize`);
    return response.data.data;
  },

  // Cancel booking
  async cancelBooking(id, reason) {
    const response = await api.post(`/bookings/${id}/cancel`, { reason });
    return response.data.data;
  },

  // Update booking status (for hosts)
  async updateBookingStatus(id, status) {
    const response = await api.patch(`/bookings/${id}/status`, { status });
    return response.data.data;
  },

  // Get session for booking
  async getSession(bookingId) {
    const response = await api.get(`/sessions/${bookingId}`);
    return response.data.data;
  },

  // Confirm session start
  async confirmSessionStart(bookingId, confirmedBy) {
    const response = await api.post(`/sessions/${bookingId}/start`, { confirmedBy });
    return response.data.data;
  },

  // End session
  async endSession(bookingId, confirmedBy) {
    const response = await api.post(`/sessions/${bookingId}/end`, { confirmedBy });
    return response.data.data;
  },
};

export default bookingService;
