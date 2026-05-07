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
    if (!s) return;
    if (!s.connected) {
      console.debug('[Socket] emit queued while disconnected', event, data);
    }
    console.debug('[Socket] emit', event, data);
    s.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    const s = getSocket();
    if (!s) return () => { };
    console.debug('[Socket] on', event);
    s.on(event, handler);
    return () => s?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    console.debug('[Socket] off', event);
    getSocket()?.off(event, handler);
  }, []);

  return { emit, on, off, socket: socketRef.current };
};
