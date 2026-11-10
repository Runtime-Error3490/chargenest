import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Turn an axios error into a message a user can act on
function toFriendlyMessage(error) {
  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Please try again.';
  }
  if (!error.response) {
    return "Can't reach the server. Check your connection and try again.";
  }

  const apiError = error.response.data?.error;
  // Validation errors: list each field's own message
  if (Array.isArray(apiError?.details) && apiError.details.length > 0) {
    return apiError.details.map(d => d.message).join('. ');
  }
  if (apiError?.message) return apiError.message;

  const status = error.response.status;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 413) return 'The file is too large.';
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Read the saved token on every request, so calls made before initAuth runs are not sent without it
    if (!config.headers.Authorization) {
      const { useAuthStore } = await import('../store/authStore');
      const token = useAuthStore.getState().accessToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
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

    // Replace axios's generic "Request failed with status code 400" with a readable message,
    // so every page that shows err.message gets it for free.
    error.message = toFriendlyMessage(error);
    error.fieldErrors = error.response?.data?.error?.details || [];
    // Lets pages react to specific backend codes, for example DEPOSIT_REQUIRED
    error.apiCode = error.response?.data?.error?.details?.code || error.response?.data?.error?.code;

    return Promise.reject(error);
  }
);

export default api;
