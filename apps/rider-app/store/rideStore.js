import { create } from 'zustand';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export const useRideStore = create((set, get) => ({
  currentRide:  null,
  fareEstimate: null,
  driverLocation: null,
  status: 'idle', // idle | searching | accepted | driver_arriving | in_progress | completed | cancelled

  // ─── Get fare estimate ──────────────────────────────────────
  getEstimate: async (pickup, destination) => {
    try {
      const { data } = await api.get('/api/rides/estimate', {
        params: {
          pickupLng: pickup.coordinates[0],
          pickupLat: pickup.coordinates[1],
          destLng:   destination.coordinates[0],
          destLat:   destination.coordinates[1],
        },
      });
      set({ fareEstimate: data.data });
      return data.data;
    } catch (err) {
      toast.error('Could not get fare estimate');
      return null;
    }
  },

  // ─── Request a ride ─────────────────────────────────────────
  requestRide: async (pickup, destination, paymentMethod = 'card') => {
    try {
      const { data } = await api.post('/api/rides', {
        pickup,
        destination,
        paymentMethod,
      });
      set({ currentRide: data.data.ride, status: 'searching' });
      return data.data.ride;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request ride');
      return null;
    }
  },

  // ─── Cancel ride ────────────────────────────────────────────
  cancelRide: async (reason = 'Cancelled by rider') => {
    const { currentRide } = get();
    if (!currentRide) return;
    try {
      await api.put(`/api/rides/${currentRide._id}/cancel`, { reason });
      set({ currentRide: null, status: 'idle', fareEstimate: null, driverLocation: null });
      toast.success('Ride cancelled');
    } catch (err) {
      toast.error('Failed to cancel ride');
    }
  },

  // ─── Socket event handlers ───────────────────────────────────
  setDriverFound:    (ride)     => set({ currentRide: { ...get().currentRide, ...ride }, status: 'accepted' }),
  setDriverArriving: ()         => set({ status: 'driver_arriving' }),
  setRideStarted:    ()         => set({ status: 'in_progress' }),
  setRideCompleted:  ()         => set({ status: 'completed' }),
  setDriverLocation: (location) => set({ driverLocation: location }),

  // ─── Rate ride ──────────────────────────────────────────────
  rateRide: async (score, comment) => {
    const { currentRide } = get();
    if (!currentRide) return;
    try {
      await api.post(`/api/rides/${currentRide._id}/rate`, { score, comment });
      toast.success('Thanks for your rating!');
      set({ currentRide: null, status: 'idle', fareEstimate: null, driverLocation: null });
    } catch (err) {
      toast.error('Failed to submit rating');
    }
  },

  reset: () => set({ currentRide: null, fareEstimate: null, driverLocation: null, status: 'idle' }),
}));