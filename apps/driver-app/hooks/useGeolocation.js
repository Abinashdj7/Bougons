'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export const useGeolocation = (watch = false) => {
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const watchId = useRef(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setLoading(false);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!watch || !navigator.geolocation) return;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [watch]);

  useEffect(() => { getLocation(); }, [getLocation]);

  return { location, error, loading, getLocation };
};
