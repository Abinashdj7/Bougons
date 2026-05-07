'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useRideStore } from '@/store/rideStore';
import { useSocket } from '@/hooks/useSocket';
import {
  Car, MapPin, Phone, MessageCircle, Star,
  CheckCircle, Clock, Navigation, X
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STEPS = {
  accepted:        { label: 'Driver accepted',    icon: Car,         color: 'text-blue-500',   bg: 'bg-blue-50' },
  driver_arriving: { label: 'Driver is arriving', icon: Navigation,  color: 'text-orange-500', bg: 'bg-orange-50' },
  in_progress:     { label: 'Ride in progress',   icon: Car,         color: 'text-green-500',  bg: 'bg-green-50' },
  completed:       { label: 'Ride completed',      icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
};

export default function TrackingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { currentRide, status, driverLocation, setDriverLocation, setDriverArriving, setRideStarted, setRideCompleted, cancelRide, rateRide } = useRideStore();
  const { on, off, emit } = useSocket();

  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages,    setMessages]    = useState([]);
  const [rating,      setRating]      = useState(0);
  const [showRating,  setShowRating]  = useState(false);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    if (!currentRide)     { router.replace('/dashboard'); return; }
  }, [isAuthenticated, currentRide, router]);


  useEffect(() => {
    if (!currentRide) return;


    emit('rider:track_driver', { driverId: currentRide.driver });

    const onLocation = ({ coordinates, heading }) => {
      setDriverLocation({ coordinates, heading });
      updateDriverMarker(coordinates);
    };
    const onArriving  = () => { setDriverArriving(); toast('🚗 Driver is arriving!'); };
    const onStarted   = () => { setRideStarted();    toast('▶️ Ride started!'); };
    const onCompleted = () => {
      setRideCompleted();
      setShowRating(true);
      toast.success('🏁 You have arrived!');
    };
    const onMessage   = ({ message, senderRole }) => {
      setMessages(prev => [...prev, { text: message, from: senderRole, time: Date.now() }]);
      if (!chatOpen) toast(`💬 ${message}`);
    };
    const onCancelled = ({ reason }) => {
      toast.error(`Ride cancelled: ${reason}`);
      useRideStore.getState().reset();
      router.replace('/dashboard');
    };

    on('driver:location',       onLocation);
    on('ride:driver_arriving',  onArriving);
    on('ride:started',          onStarted);
    on('ride:completed',        onCompleted);
    on('chat:message',          onMessage);
    on('ride:cancelled',        onCancelled);

    return () => {
      off('driver:location',      onLocation);
      off('ride:driver_arriving', onArriving);
      off('ride:started',         onStarted);
      off('ride:completed',       onCompleted);
      off('chat:message',         onMessage);
      off('ride:cancelled',       onCancelled);
    };
  }, [currentRide, on, off, emit]);


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

      const defaultCoords = driverLocation?.coordinates
        ? [driverLocation.coordinates[1], driverLocation.coordinates[0]]
        : [48.8566, 2.3522];

      mapInstance.current = L.map(mapRef.current).setView(defaultCoords, 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance.current);


      if (currentRide?.destination?.location?.coordinates) {
        const [lng, lat] = currentRide.destination.location.coordinates;
        L.marker([lat, lng]).addTo(mapInstance.current).bindPopup('Destination');
      }
    };

    initMap();
  }, []);


  const updateDriverMarker = async (coordinates) => {
    if (!mapInstance.current) return;
    const L = (await import('leaflet')).default;
    const [lng, lat] = coordinates;

    if (driverMarker.current) {
      driverMarker.current.setLatLng([lat, lng]);
    } else {
      const carIcon = L.divIcon({
        className: '',
        html: `<div style="background:#f97316;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🚗</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      driverMarker.current = L.marker([lat, lng], { icon: carIcon }).addTo(mapInstance.current);
    }
    mapInstance.current.panTo([lat, lng]);
  };

  const sendMessage = () => {
    if (!chatMessage.trim() || !currentRide?.driver) return;
    emit('chat:send', {
      rideId:      currentRide._id,
      recipientId: currentRide.driver,
      message:     chatMessage.trim(),
    });
    setMessages(prev => [...prev, { text: chatMessage, from: 'rider', time: Date.now() }]);
    setChatMessage('');
  };

  const handleCancel = async () => {
    await cancelRide('Cancelled by rider');
    router.replace('/dashboard');
  };

  const handleRate = async () => {
    if (!rating) { toast.error('Please select a rating'); return; }
    await rateRide(rating, '');
    router.replace('/dashboard');
  };

  if (!currentRide) return null;

  const currentStep = STATUS_STEPS[status];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {}
      <div ref={mapRef} className="flex-1 min-h-[50vh] z-0" />

      {}
      <div className="bg-white rounded-t-3xl shadow-2xl p-6 space-y-4 z-10">

        {}
        {currentStep && (
          <div className={`flex items-center gap-3 ${currentStep.bg} rounded-2xl p-4`}>
            <div className={`w-10 h-10 ${currentStep.bg} rounded-xl flex items-center justify-center`}>
              <currentStep.icon className={`w-5 h-5 ${currentStep.color}`} />
            </div>
            <div>
              <p className={`font-semibold ${currentStep.color}`}>{currentStep.label}</p>
              <p className="text-xs text-gray-500">
                {status === 'accepted'        && 'Your driver is on the way'}
                {status === 'driver_arriving' && 'Please be ready at pickup'}
                {status === 'in_progress'     && `Heading to ${currentRide.destination?.address}`}
                {status === 'completed'       && 'Thank you for riding with Bougons!'}
              </p>
            </div>
          </div>
        )}

        {}
        {showRating && (
          <div className="card text-center space-y-4">
            <p className="font-semibold text-gray-900">Rate your ride</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}>
                  <Star className={`w-8 h-8 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
            <button onClick={handleRate} className="btn-primary w-full">Submit Rating</button>
          </div>
        )}

        {}
        {!showRating && (
          <>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-primary-500" />
                <span className="truncate max-w-[180px]">{currentRide.destination?.address}</span>
              </div>
              <span className="font-semibold text-primary-500">€{currentRide.fare?.estimated}</span>
            </div>

            {}
            <div className="flex gap-3">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle className="w-4 h-4" /> Chat
              </button>
              {['searching', 'accepted', 'driver_arriving'].includes(status) && (
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
                      <div key={i} className={`flex ${m.from === 'rider' ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs px-3 py-1.5 rounded-full ${m.from === 'rider' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
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
                    placeholder="Message driver..."
                    className="flex-1 px-4 py-3 text-sm focus:outline-none bg-white"
                  />
                  <button onClick={sendMessage} className="px-4 text-primary-500 font-medium text-sm">
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
