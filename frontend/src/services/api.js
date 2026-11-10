import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is set in authStore
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - try refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Dynamic import to avoid circular dependency
        const { useAuthStore } = await import('../store/authStore');
        const refreshed = await useAuthStore.getState().refreshAccessToken();
        
        if (refreshed) {
          const token = useAuthStore.getState().accessToken;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout
        const { useAuthStore } = await import('../store/authStore');
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
