'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';

export const useSocket = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = getSocket();
  }, []);

  const emit = useCallback((event, data) => {
    const s = getSocket();
    if (s?.connected) s.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    const s = getSocket();
    s?.on(event, handler);
    return () => s?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    getSocket()?.off(event, handler);
  }, []);

  return { emit, on, off, socket: socketRef.current };
};