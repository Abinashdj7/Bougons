'use client';

import { useEffect, useRef } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';

// Phase 2 will use react-leaflet fully. This component is the shell.
export default function RiderMap({ onLocationSelect, markers = [] }) {
  const mapRef = useRef(null);
  const { location, loading, error } = useGeolocation();

  // Leaflet is loaded dynamically to avoid SSR issues
  useEffect(() => {
    if (typeof window === 'undefined' || !location) return;

    let map;
    let L;

    const initMap = async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Fix default marker icons in Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapRef.current && !mapRef.current._leaflet_id) {
        map = L.map(mapRef.current).setView([location.lat, location.lng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // User location marker
        L.marker([location.lat, location.lng])
          .addTo(map)
          .bindPopup('Your location')
          .openPopup();

        // Click to select pickup/destination
        if (onLocationSelect) {
          map.on('click', (e) => {
            onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
          });
        }
      }
    };

    initMap();

    return () => {
      if (map) map.remove();
    };
  }, [location]);

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Getting your location...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-red-50 rounded-2xl flex items-center justify-center">
        <p className="text-sm text-red-500 text-center px-4">
          📍 Location access denied. Please enable location in your browser.
        </p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full rounded-2xl z-0" />;
}
