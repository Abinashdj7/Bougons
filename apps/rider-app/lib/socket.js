import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[Socket] No access token found for socket auth');
    }

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.info('[Socket] connected', socket.id);
    });
    socket.on('connect_error', (err) => {
      console.error('[Socket] connect_error', err.message || err);
    });
    socket.on('disconnect', (reason) => {
      console.info('[Socket] disconnected', reason);
    });
    socket.on('reconnect_attempt', (attempt) => {
      console.info('[Socket] reconnect attempt', attempt);
    });
    socket.on('reconnect_failed', () => {
      console.warn('[Socket] reconnect failed');
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
