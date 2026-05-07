import { create } from 'zustand';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export const useDriverStore = create((set, get) => ({
  isOnline:    false,
  activeRide:  null,
  pendingRide: null,
  earnings:    { today: 0, total: 0 },
  status: 'idle',


  toggleOnline: async (emit) => {
    const { isOnline } = get();
    try {
      const { data } = await api.put('/api/profile/driver/status');
      const nowOnline = data.data.isOnline;
      set({ isOnline: nowOnline });


      emit(nowOnline ? 'driver:online' : 'driver:offline', {});
      toast.success(nowOnline ? '🟢 You are online' : '🔴 You are offline');
    } catch {
      toast.error('Failed to update status');
    }
  },


  setPendingRide: (rideData) => {
    set({ pendingRide: rideData, status: 'pending_request' });
  },


  acceptRide: async (emit) => {
    const { pendingRide } = get();
    if (!pendingRide) return;
    try {
      const { data } = await api.put(`/api/rides/${pendingRide.rideId}/accept`);
      set({ activeRide: data.data.ride, pendingRide: null, status: 'accepted' });


      emit('driver:accept_ride', {
        rideId:  pendingRide.rideId,
        riderId: pendingRide.riderId,
      });

      toast.success('Ride accepted!');
      return data.data.ride;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept ride');
      set({ pendingRide: null, status: 'idle' });
    }
  },


  declineRide: () => {
    set({ pendingRide: null, status: 'idle' });
    toast('Ride declined');
  },


  markArriving: async (emit) => {
    const { activeRide } = get();
    if (!activeRide) return;
    try {
      await api.put(`/api/rides/${activeRide._id}/arriving`);
      set({ status: 'driver_arriving' });
      emit('driver:arriving', {
        rideId:  activeRide._id,
        riderId: activeRide.rider,
      });
    } catch {
      toast.error('Failed to update status');
    }
  },


  startRide: async (emit) => {
    const { activeRide } = get();
    if (!activeRide) return;
    try {
      const { data } = await api.put(`/api/rides/${activeRide._id}/start`);
      set({ activeRide: data.data.ride, status: 'in_progress' });
      emit('driver:started_ride', {
        rideId:  activeRide._id,
        riderId: activeRide.rider,
      });
    } catch {
      toast.error('Failed to start ride');
    }
  },


  completeRide: async (emit) => {
    const { activeRide } = get();
    if (!activeRide) return;
    try {
      const { data } = await api.put(`/api/rides/${activeRide._id}/complete`);
      const fare = data.data.ride.fare?.actual || activeRide.fare?.estimated;

      emit('driver:completed_ride', {
        rideId:  activeRide._id,
        riderId: activeRide.rider,
      });


      set((state) => ({
        activeRide: null,
        status: 'idle',
        earnings: {
          today: state.earnings.today + fare,
          total: state.earnings.total + fare,
        },
      }));

      toast.success(`🏁 Ride completed — €${fare} earned`);
    } catch {
      toast.error('Failed to complete ride');
    }
  },


  cancelRide: async (emit, reason) => {
    const { activeRide } = get();
    if (!activeRide) return;
    try {
      await api.put(`/api/rides/${activeRide._id}/cancel`, { reason });
      emit('ride:cancel', {
        rideId:      activeRide._id,
        recipientId: activeRide.rider,
        reason,
      });
      set({ activeRide: null, status: 'idle' });
    } catch {
      toast.error('Failed to cancel ride');
    }
  },
}));
