import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      // ─── Register ──────────────────────────────────────────
      register: async (formData) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/api/auth/register', formData);
          const { user, accessToken } = data.data;

          localStorage.setItem('accessToken', accessToken);
          set({ user, accessToken, isAuthenticated: true });

          toast.success(`Welcome, ${user.name}!`);
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || 'Registration failed';
          toast.error(message);
          return { success: false, message };
        } finally {
          set({ isLoading: false });
        }
      },

      // ─── Login ─────────────────────────────────────────────
      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/api/auth/login', credentials);
          const { user, accessToken } = data.data;

          localStorage.setItem('accessToken', accessToken);
          set({ user, accessToken, isAuthenticated: true });

          toast.success(`Welcome back, ${user.name}!`);
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.message || 'Login failed';
          toast.error(message);
          return { success: false, message };
        } finally {
          set({ isLoading: false });
        }
      },

      // ─── Logout ────────────────────────────────────────────
      logout: async () => {
        try {
          await api.post('/api/auth/logout');
        } catch (_) {}
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null, isAuthenticated: false });
        toast.success('Logged out');
      },

      // ─── Update user in store ──────────────────────────────
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
