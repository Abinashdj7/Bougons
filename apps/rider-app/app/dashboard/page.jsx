'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useRideStore } from '@/store/rideStore';
import { useSocket } from '@/hooks/useSocket';
import { MapPin, History, User, LogOut, Star, Car, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, _hasHydrated } = useAuthStore();
  const { status, currentRide, setDriverFound, setDriverArriving, setRideStarted, setRideCompleted } = useRideStore();
  const { on, off } = useSocket();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace('/auth/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, _hasHydrated]);

  useEffect(() => {
    const onDriverFound = (data) => {
      setDriverFound(data);
      toast.success('Driver found! They are on their way.');
      router.push('/ride/tracking');
    };
    const onCancelled = ({ reason }) => {
      toast.error(`Ride cancelled: ${reason}`);
      useRideStore.getState().reset();
    };

    on('ride:driver_found',  onDriverFound);
    on('ride:cancelled',     onCancelled);

    return () => {
      off('ride:driver_found',  onDriverFound);
      off('ride:cancelled',     onCancelled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, off]);

  useEffect(() => {
    if (['accepted', 'driver_arriving', 'in_progress'].includes(status)) {
      router.push('/ride/tracking');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">Bougons</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              data-cy="logout"
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {}
        <div className="bg-gradient-to-r from-primary-500 to-orange-400 rounded-2xl p-6 text-white">
          <p className="text-orange-100 text-sm font-medium">Welcome back 👋</p>
          <h2 className="text-2xl font-bold mt-1">{user.name}</h2>
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-4 h-4 fill-white" />
            <span className="text-sm font-medium">{user.rating?.toFixed(1)} rating</span>
          </div>
        </div>

        {}
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

        {}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
              <User className="w-7 h-7 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <span className="text-xs bg-primary-50 text-primary-600 font-medium px-3 py-1 rounded-full capitalize">
              {user.role}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
