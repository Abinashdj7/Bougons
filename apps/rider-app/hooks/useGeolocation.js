'use client';

import { useState, useEffect, useCallback } from 'react';

export const useGeolocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
  }, []);

  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) return null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, ...options }
    );

    return watchId;
  }, []);

  const clearWatch = useCallback((watchId) => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    getLocation();
  }, []);

  return { location, error, loading, getLocation, watchPosition, clearWatch };
};
