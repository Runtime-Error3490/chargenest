import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Set tokens after login
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true });
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      },

      // Set user data
      setUser: (user) => {
        set({ user });
      },

      // Login
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const data = response.data.data;

          if (data.mfaRequired) {
            set({ isLoading: false });
            return { mfaRequired: true, tempToken: data.tempToken };
          }

          // No MFA - direct login
          get().setTokens(data.accessToken, data.refreshToken);
          get().setUser(data.user);
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Login failed';
          set({ isLoading: false, error: message });
          throw new Error(message);
        }
      },

      // Verify MFA
      verifyMfa: async (tempToken, totpCode) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/verify-mfa', { tempToken, totpCode });
          const data = response.data.data;

          get().setTokens(data.accessToken, data.refreshToken);
          get().setUser(data.user);
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Verification failed';
          set({ isLoading: false, error: message });
          throw new Error(message);
        }
      },

      // Register
      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', userData);
          set({ isLoading: false });
          return response.data.data;
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Registration failed';
          set({ isLoading: false, error: message });
          throw new Error(message);
        }
      },

      // Refresh token
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const data = response.data.data;
          
          set({ accessToken: data.accessToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          return true;
        } catch (error) {
          get().logout();
          return false;
        }
      },

      // Logout
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
        delete api.defaults.headers.common['Authorization'];
      },

      // Initialize auth from stored tokens
      initAuth: async () => {
        const { accessToken, refreshToken } = get();
        if (!accessToken) return;

        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.data.user, isAuthenticated: true });
        } catch (error) {
          // Try refresh
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            const response = await api.get('/auth/me');
            set({ user: response.data.data.user, isAuthenticated: true });
          }
        }
      },

      // Check if user has role
      hasRole: (role) => {
        const { user } = get();
        return user?.roles?.includes(role) || false;
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        // Keep this so a full page load (like PayPal sending the user back) is not bounced to /login
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
