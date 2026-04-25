'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Car, DollarSign, Star, LogOut, ToggleLeft, ToggleRight, MapPin } from 'lucide-react';

export default function DriverDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState({ today: 0, total: 0 });
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    if (user?.role !== 'driver') {
      toast.error('This app is for drivers only');
      router.replace('/auth/login');
    }
  }, [isAuthenticated, user, router]);

  const toggleStatus = async () => {
    setToggling(true);
    try {
      const { data } = await api.put('/api/profile/driver/status');
      setIsOnline(data.data.isOnline);
      toast.success(data.message);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl text-gray-900">RideX</span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full">Driver</span>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Online Toggle */}
        <div className={`rounded-2xl p-6 transition-colors ${isOnline ? 'bg-green-500' : 'bg-gray-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">You are currently</p>
              <p className="text-white text-2xl font-bold mt-0.5">
                {isOnline ? 'Online 🟢' : 'Offline 🔴'}
              </p>
              <p className="text-white/60 text-xs mt-1">
                {isOnline ? 'Ready to accept rides' : 'Go online to receive ride requests'}
              </p>
            </div>
            <button
              onClick={toggleStatus}
              disabled={toggling}
              className="bg-white/20 hover:bg-white/30 rounded-2xl p-3 transition-colors"
            >
              {isOnline
                ? <ToggleRight className="w-10 h-10 text-white" />
                : <ToggleLeft className="w-10 h-10 text-white" />
              }
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Today</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">€{earnings.today.toFixed(2)}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">€{earnings.total.toFixed(2)}</p>
          </div>
        </div>

        {/* Driver Profile */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Your Profile</h3>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Car className="w-7 h-7 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-medium text-gray-700">{user.rating?.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Map placeholder */}
        <div className="card border-dashed border-2 border-gray-200 bg-gray-50/50 flex flex-col items-center gap-2 py-8">
          <MapPin className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">Live map coming in Phase 2</p>
        </div>

      </div>
    </div>
  );
}
