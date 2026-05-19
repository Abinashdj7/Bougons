import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set) => ({
      user:            null,
      isAuthenticated: false,
      isLoading:       false,

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/api/auth/login', credentials);
          const { user, accessToken } = data.data;
          if (user.role !== 'admin') {
            toast.error('Admin access only');
            return { success: false };
          }
          localStorage.setItem('accessToken', accessToken);
          set({ user, isAuthenticated: true });
          toast.success(`Welcome, ${user.name}`);
          return { success: true };
        } catch (err) {
          toast.error(err.response?.data?.message || 'Login failed');
          return { success: false };
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await api.post('/api/auth/logout'); } catch {}
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false });
      },
    }),
    { name: 'admin-auth', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);
