'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useRideStore } from '@/store/rideStore';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSocket } from '@/hooks/useSocket';
import { MapPin, Navigation, ArrowLeft, Car, Clock, Euro, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

// Simple geocoding using OpenStreetMap Nominatim (free, no API key)
const geocodeAddress = async (address) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
  );
  const data = await res.json();
  if (!data.length) throw new Error('Address not found');
  return {
    address,
    location: {
      type: 'Point',
      coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)],
    },
  };
};

export default function RequestRidePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { getEstimate, requestRide, fareEstimate, status } = useRideStore();
  const { location } = useGeolocation();
  const { emit } = useSocket();

  const [pickupAddress,      setPickupAddress]      = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickup,             setPickup]             = useState(null);
  const [destination,        setDestination]        = useState(null);
  const [loadingEstimate,    setLoadingEstimate]    = useState(false);
  const [loadingRide,        setLoadingRide]        = useState(false);
  const [step,               setStep]               = useState('form'); // form | estimate | searching

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login');
  }, [isAuthenticated, router]);

  // Pre-fill pickup with current location
  useEffect(() => {
    if (location && !pickupAddress) {
      setPickupAddress(`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
      setPickup({
        address: 'Current location',
        location: {
          type: 'Point',
          coordinates: [location.lng, location.lat],
        },
      });
    }
  }, [location]);

  const handleGetEstimate = async () => {
    if (!pickupAddress || !destinationAddress) {
      toast.error('Please enter pickup and destination');
      return;
    }
    setLoadingEstimate(true);
    try {
      let pickupData = pickup;
      if (!pickupData) pickupData = await geocodeAddress(pickupAddress);

      const destData = await geocodeAddress(destinationAddress);
      setPickup(pickupData);
      setDestination(destData);

      await getEstimate(pickupData.location, destData.location);
      setStep('estimate');
    } catch (err) {
      toast.error(err.message || 'Could not find address');
    } finally {
      setLoadingEstimate(false);
    }
  };

  const handleRequestRide = async () => {
    setLoadingRide(true);
    try {
      const ride = await requestRide(pickup, destination);
      if (ride) {
        setStep('searching');
        // Notify drivers via socket
        emit('rider:request_ride', {
          rideId: ride._id,
          pickup: pickup.location.coordinates,
          destination: destination.location.coordinates,
          fare: fareEstimate?.estimated,
        });
      }
    } finally {
      setLoadingRide(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-lg text-gray-900">Book a Ride</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Searching state */}
        {step === 'searching' && (
          <div className="card text-center py-12">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="w-8 h-8 text-primary-500 animate-bounce" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Finding your driver...</h2>
            <p className="text-gray-500 text-sm mb-6">We're matching you with the nearest available driver</p>
            <button
              onClick={() => { useRideStore.getState().cancelRide(); setStep('form'); }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Form */}
        {step !== 'searching' && (
          <>
            <div className="card space-y-4">

              {/* Pickup */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pickup</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-500 rounded-full" />
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => { setPickupAddress(e.target.value); setPickup(null); setStep('form'); }}
                    placeholder="Enter pickup address"
                    className="input-field pl-9"
                  />
                  {location && (
                    <button
                      onClick={() => {
                        setPickupAddress('Current location');
                        setPickup({ address: 'Current location', location: { type: 'Point', coordinates: [location.lng, location.lat] } });
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <Navigation className="w-4 h-4 text-primary-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Destination</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => { setDestinationAddress(e.target.value); setDestination(null); setStep('form'); }}
                    placeholder="Where are you going?"
                    className="input-field pl-9"
                  />
                </div>
              </div>

              <button
                onClick={handleGetEstimate}
                disabled={loadingEstimate || !pickupAddress || !destinationAddress}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loadingEstimate
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Get Estimate'
                }
              </button>

            </div>

            {/* Estimate card */}
            {step === 'estimate' && fareEstimate && (
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900">Ride Summary</h3>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Euro className="w-4 h-4 text-primary-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">€{fareEstimate.estimated}</p>
                    <p className="text-xs text-gray-500">Estimated</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Car className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{fareEstimate.distance} km</p>
                    <p className="text-xs text-gray-500">Distance</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <Clock className="w-4 h-4 text-green-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{fareEstimate.duration} min</p>
                    <p className="text-xs text-gray-500">Est. time</p>
                  </div>
                </div>

                {fareEstimate.surgeMultiplier > 1 && (
                  <div className="flex items-center gap-2 bg-orange-50 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <p className="text-xs text-orange-700">
                      Surge pricing active ({fareEstimate.surgeMultiplier}x) — high demand in your area
                    </p>
                  </div>
                )}

                {/* Fare breakdown */}
                <div className="border-t border-gray-100 pt-3 space-y-1.5">
                  {[
                    ['Base fare',    `€${fareEstimate.breakdown?.baseFare}`],
                    ['Distance',     `€${fareEstimate.breakdown?.distanceFare}`],
                    ['Time',         `€${fareEstimate.breakdown?.timeFare}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-700">{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-100">
                    <span>Total</span>
                    <span className="text-primary-500">€{fareEstimate.estimated}</span>
                  </div>
                </div>

                <button
                  onClick={handleRequestRide}
                  disabled={loadingRide}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loadingRide
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : `Confirm Ride — €${fareEstimate.estimated}`
                  }
                </button>

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}