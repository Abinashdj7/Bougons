'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';
import { useSocket } from '@/hooks/useSocket';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  Car, DollarSign, Star, LogOut,
  ToggleLeft, ToggleRight, MapPin, Clock, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DriverDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout, _hasHydrated } = useAuthStore();
  const {
    isOnline, pendingRide, earnings, status,
    toggleOnline, setPendingRide, acceptRide, declineRide,
  } = useDriverStore();
  const { emit, on, off } = useSocket();
  const { location } = useGeolocation(isOnline);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    if (user?.role !== 'driver') { router.replace('/auth/login'); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, _hasHydrated]);

  useEffect(() => {
    if (!isOnline || !location) return;

    emit('driver:location_update', {
      coordinates: [location.lng, location.lat],
      heading: 0,
      speed: 0,
    });

    import('@/lib/api').then(({ default: api }) => {
      api.put('/api/location/drivers/update', {
        coordinates: [location.lng, location.lat],
      }).catch(() => { });
    });
  }, [location, isOnline, emit]);

  useEffect(() => {
    const onNewRequest = (data) => {
      console.info('[Socket] received ride:new_request', data);
      if (!isOnline) {
        console.warn('[Socket] ride:new_request ignored because driver is offline');
        return;
      }
      setPendingRide(data);
      toast('🚗 New ride request!', { duration: 15000 });
    };

    on('ride:new_request', onNewRequest);
    return () => off('ride:new_request', onNewRequest);
  }, [isOnline, on, off, setPendingRide]);

  useEffect(() => {
    if (['accepted', 'driver_arriving', 'in_progress'].includes(status)) {
      router.push('/ride/active');
    }
  }, [status, router]);

  const handleToggleOnline = async () => {
    setToggling(true);
    await toggleOnline(emit);
    setToggling(false);
  };

  const handleAccept = async () => {
    await acceptRide(emit);
  };

  const handleDecline = () => {
    declineRide();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">

      {}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl text-gray-900">Bougons</span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full">Driver</span>
            </div>
          </div>
          <button
            data-cy="logout"
            onClick={async () => { await logout(); router.push('/auth/login'); }}
            className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {}
        <div className={`rounded-2xl p-6 transition-all duration-300 ${isOnline ? 'bg-green-500' : 'bg-gray-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">You are currently</p>
              <p className="text-white text-2xl font-bold mt-0.5">
                {isOnline ? 'Online 🟢' : 'Offline 🔴'}
              </p>
              <p className="text-white/60 text-xs mt-1">
                {isOnline ? 'Ready to accept rides' : 'Go online to receive requests'}
              </p>
              {isOnline && location && (
                <p className="text-white/50 text-xs mt-1">
                  📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
              )}
            </div>
            <button
              onClick={handleToggleOnline}
              disabled={toggling}
              className="bg-white/20 hover:bg-white/30 rounded-2xl p-3 transition-colors disabled:opacity-50"
            >
              {isOnline
                ? <ToggleRight className="w-10 h-10 text-white" />
                : <ToggleLeft className="w-10 h-10 text-white" />
              }
            </button>
          </div>
        </div>

        {}
        {pendingRide && (
          <div className="card border-2 border-primary-500 animate-pulse-slow">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-primary-500" />
              <h3 className="font-bold text-gray-900">New Ride Request!</h3>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-primary-500 rounded-full mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="text-sm font-medium text-gray-800">
                    {pendingRide.pickup
                      ? `${pendingRide.pickup[1]?.toFixed(4)}, ${pendingRide.pickup[0]?.toFixed(4)}`
                      : 'Loading...'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Destination</p>
                  <p className="text-sm font-medium text-gray-800">
                    {pendingRide.destination
                      ? `${pendingRide.destination[1]?.toFixed(4)}, ${pendingRide.destination[0]?.toFixed(4)}`
                      : 'Loading...'}
                  </p>
                </div>
              </div>
              {pendingRide.fare && (
                <div className="bg-green-50 rounded-xl px-4 py-2 flex justify-between">
                  <span className="text-sm text-gray-600">Estimated fare</span>
                  <span className="font-bold text-green-600">€{pendingRide.fare}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDecline}
                className="btn-secondary text-sm py-3"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="btn-primary text-sm py-3"
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {}
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

        {}
        <div className="card">
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

      </div>
    </div>
  );
}
