import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            _hasHydrated: false,

            setHasHydrated: () => set({ _hasHydrated: true }),

            register: async (formData) => {
                set({ isLoading: true });
                try {
                    const { data } = await api.post('/api/auth/register', formData);
                    const { user, accessToken } = data.data;

                    if (user.role !== 'admin') {
                        localStorage.removeItem('accessToken');
                        set({ user: null, accessToken: null, isAuthenticated: false });
                        toast.error('Please register using an admin account');
                        return { success: false, message: 'Please register using an admin account' };
                    }

                    localStorage.setItem('accessToken', accessToken);
                    set({ user, accessToken, isAuthenticated: true });

                    toast.success(`Welcome, ${user.name}!`);
                    return { success: true, message: 'Registration successful' };
                } catch (error) {
                    const errorMessage = error.response?.data?.message || 'Registration failed';
                    toast.error(errorMessage);
                    return { success: false, message: errorMessage };
                } finally {
                    set({ isLoading: false });
                }
            },

            login: async (email, password) => {
                set({ isLoading: true });
                try {
                    const { data } = await api.post('/api/auth/login', { email, password });
                    const { user, accessToken } = data.data;

                    if (user.role !== 'admin') {
                        localStorage.removeItem('accessToken');
                        set({ user: null, accessToken: null, isAuthenticated: false });
                        toast.error('Admin access required');
                        return { success: false, message: 'Admin access required' };
                    }

                    localStorage.setItem('accessToken', accessToken);
                    set({ user, accessToken, isAuthenticated: true });

                    toast.success(`Welcome back, ${user.name}!`);
                    return { success: true, message: 'Login successful' };
                } catch (error) {
                    const errorMessage = error.response?.data?.message || 'Login failed';
                    toast.error(errorMessage);
                    return { success: false, message: errorMessage };
                } finally {
                    set({ isLoading: false });
                }
            },

            logout: async () => {
                try {
                    await api.post('/api/auth/logout');
                } catch (error) {
                    console.error('Logout error:', error);
                } finally {
                    localStorage.removeItem('accessToken');
                    set({ user: null, accessToken: null, isAuthenticated: false });
                    toast.success('Logged out successfully');
                }
            },

            checkAuth: async () => {
                const token = localStorage.getItem('accessToken');
                if (!token) {
                    set({ isAuthenticated: false, user: null });
                    return;
                }

                try {
                    const { data } = await api.get('/api/auth/me');
                    set({ user: data.data, isAuthenticated: true, accessToken: token });
                } catch (error) {
                    localStorage.removeItem('accessToken');
                    set({ isAuthenticated: false, user: null, accessToken: null });
                }
            },
        }),
        {
            name: 'admin-auth',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated();
            },
        }
    )
);
