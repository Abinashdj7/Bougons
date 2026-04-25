'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { MapPin, History, User, LogOut, Star, Car } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, router]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">RideX</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-primary-500 to-orange-400 rounded-2xl p-6 text-white">
          <p className="text-orange-100 text-sm font-medium">Welcome back 👋</p>
          <h2 className="text-2xl font-bold mt-1">{user.name}</h2>
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-4 h-4 fill-white" />
            <span className="text-sm font-medium">{user.rating?.toFixed(1)} rating</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/ride/request')}
              className="card flex flex-col items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-center"
            >
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Book a Ride</p>
                <p className="text-xs text-gray-500 mt-0.5">Get there fast</p>
              </div>
            </button>

            <button
              onClick={() => router.push('/history')}
              className="card flex flex-col items-center gap-3 hover:shadow-md transition-shadow cursor-pointer text-center"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <History className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Ride History</p>
                <p className="text-xs text-gray-500 mt-0.5">Past trips</p>
              </div>
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
              <User className="w-7 h-7 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              {user.phone && <p className="text-sm text-gray-500">{user.phone}</p>}
            </div>
            <span className="text-xs bg-primary-50 text-primary-600 font-medium px-3 py-1 rounded-full capitalize">
              {user.role}
            </span>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="card border-dashed border-2 border-gray-200 bg-gray-50/50">
          <p className="text-center text-sm text-gray-400 font-medium">
            🚧 Map & live tracking coming in Phase 2
          </p>
        </div>

      </div>
    </div>
  );
}
