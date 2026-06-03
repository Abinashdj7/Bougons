'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useDriverStore } from '@/store/driverStore';
import { useSocket } from '@/hooks/useSocket';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  MapPin, Navigation, CheckCircle,
  MessageCircle, X, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  accepted: {
    label:       'Head to Pickup',
    sublabel:    'Navigate to the rider\'s pickup location',
    action:      'I\'ve Arrived',
    actionColor: 'bg-orange-500 hover:bg-orange-600',
    next:        'driver_arriving',
  },
  driver_arriving: {
    label:       'Waiting for Rider',
    sublabel:    'The rider has been notified you\'ve arrived',
    action:      'Start Ride',
    actionColor: 'bg-green-500 hover:bg-green-600',
    next:        'in_progress',
  },
  in_progress: {
    label:       'Ride in Progress',
    sublabel:    'Navigate to the destination',
    action:      'Complete Ride',
    actionColor: 'bg-blue-600 hover:bg-blue-700',
    next:        'completed',
  },
};

export default function ActiveRidePage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const { activeRide, status, markArriving, startRide, completeRide, cancelRide } = useDriverStore();
  const { emit, on, off } = useSocket();
  const { location } = useGeolocation(true);

  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages,    setMessages]    = useState([]);
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const myMarker    = useRef(null);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    if (!activeRide)      { router.replace('/dashboard'); return; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeRide, _hasHydrated]);


  useEffect(() => {
    if (!location || !activeRide) return;

    emit('driver:location_update', {
      coordinates: [location.lng, location.lat],
      heading: 0,
      speed: 0,
    });

    updateMyMarker([location.lng, location.lat]);
  }, [location, emit, activeRide]);


  useEffect(() => {
    const onMessage = ({ message, senderRole }) => {
      setMessages(prev => [...prev, { text: message, from: senderRole, time: Date.now() }]);
      if (!chatOpen) toast(`💬 ${message}`);
    };
    on('chat:message', onMessage);
    return () => off('chat:message', onMessage);
  }, [on, off, chatOpen]);


  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center = location
        ? [location.lat, location.lng]
        : [48.8566, 2.3522];

      mapInstance.current = L.map(mapRef.current).setView(center, 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance.current);


      if (activeRide?.pickup?.location?.coordinates) {
        const [lng, lat] = activeRide.pickup.location.coordinates;
        L.marker([lat, lng])
          .addTo(mapInstance.current)
          .bindPopup(`📍 Pickup: ${activeRide.pickup.address}`);
      }


      if (activeRide?.destination?.location?.coordinates) {
        const [lng, lat] = activeRide.destination.location.coordinates;
        L.marker([lat, lng])
          .addTo(mapInstance.current)
          .bindPopup(`🏁 Destination: ${activeRide.destination.address}`);
      }
    };

    initMap();
  }, []);

  const updateMyMarker = async (coordinates) => {
    if (!mapInstance.current) return;
    const L = (await import('leaflet')).default;
    const [lng, lat] = coordinates;

    if (myMarker.current) {
      myMarker.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#2563eb;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;">🚕</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      myMarker.current = L.marker([lat, lng], { icon }).addTo(mapInstance.current);
    }
    mapInstance.current.panTo([lat, lng]);
  };

  const handleAction = async () => {
    if (status === 'accepted')        await markArriving(emit);
    if (status === 'driver_arriving') await startRide(emit);
    if (status === 'in_progress') {
      await completeRide(emit);
      router.replace('/dashboard');
    }
  };

  const handleCancel = async () => {
    await cancelRide(emit, 'Cancelled by driver');
    router.replace('/dashboard');
  };

  const sendMessage = () => {
    if (!chatMessage.trim() || !activeRide?.rider) return;
    emit('chat:send', {
      rideId:      activeRide._id,
      recipientId: activeRide.rider,
      message:     chatMessage.trim(),
    });
    setMessages(prev => [...prev, { text: chatMessage, from: 'driver', time: Date.now() }]);
    setChatMessage('');
  };

  if (!activeRide) return null;

  const config = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {}
      <div ref={mapRef} className="flex-1 min-h-[50vh] z-0" />

      {}
      <div className="bg-white rounded-t-3xl shadow-2xl p-6 space-y-4 z-10">

        {}
        {config && (
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="font-bold text-blue-900">{config.label}</p>
            <p className="text-xs text-blue-600 mt-0.5">{config.sublabel}</p>
          </div>
        )}

        {}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-primary-500 rounded-full flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Pickup</p>
              <p className="text-sm font-medium text-gray-800">{activeRide.pickup?.address}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Destination</p>
              <p className="text-sm font-medium text-gray-800">{activeRide.destination?.address}</p>
            </div>
          </div>
          <div className="flex justify-between text-sm pt-1">
            <span className="text-gray-500">Estimated fare</span>
            <span className="font-bold text-green-600">€{activeRide.fare?.estimated}</span>
          </div>
        </div>

        {}
        {config && (
          <button
            onClick={handleAction}
            className={`w-full text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 ${config.actionColor}`}
          >
            <CheckCircle className="w-5 h-5" />
            {config.action}
          </button>
        )}

        {}
        <div className="flex gap-3">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
          >
            <MessageCircle className="w-4 h-4" /> Chat
          </button>
          {status !== 'in_progress' && (
            <button
              onClick={handleCancel}
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>

        {}
        {chatOpen && (
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="bg-gray-50 p-3 h-28 overflow-y-auto space-y-2">
              {messages.length === 0
                ? <p className="text-xs text-gray-400 text-center mt-4">No messages yet</p>
                : messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'driver' ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-xs px-3 py-1.5 rounded-full ${m.from === 'driver' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                      {m.text}
                    </span>
                  </div>
                ))
              }
            </div>
            <div className="flex border-t border-gray-100">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Message rider..."
                className="flex-1 px-4 py-3 text-sm focus:outline-none bg-white"
              />
              <button onClick={sendMessage} className="px-4 text-blue-600 font-medium text-sm">
                Send
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
