const { Server } = require('socket.io');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const { logger } = require('./utils/logger');

const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://bougons-location:4003';
const RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://bougons-ride-service:4002';

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ],
      credentials: true,
    },

    pingTimeout: 60000,
    pingInterval: 25000,
  });


  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token provided'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id, role: decoded.role };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    logger.info(`[Socket] ${role} connected: ${id}`);


    socket.join(`user:${id}`);
    if (role === 'driver') socket.join('drivers');


    socket.on('rider:request_ride', (data) => {
      logger.info(`[Socket] Ride request from rider ${id}`);
      const driverCount = io.sockets.adapter.rooms.get('drivers')?.size || 0;
      logger.info(`[Socket] Broadcasting ride request to ${driverCount} drivers`);
      io.to('drivers').emit('ride:new_request', { ...data, riderId: id });
    });

    socket.on('rider:track_driver', ({ driverId }) => {
      socket.join(`tracking:${driverId}`);
      logger.info(`[Socket] Rider ${id} tracking driver ${driverId}`);
    });

    socket.on('rider:stop_tracking', ({ driverId }) => {
      socket.leave(`tracking:${driverId}`);
    });


    socket.on('driver:location_update', ({ coordinates, heading, speed }) => {
      if (role !== 'driver') return;


      socket.to(`tracking:${id}`).emit('driver:location', {
        driverId: id,
        coordinates,
        heading,
        speed,
        timestamp: Date.now(),
      });
    });

    socket.on('driver:accept_ride', ({ rideId, riderId }) => {
      if (role !== 'driver') return;
      logger.info(`[Socket] Driver ${id} accepted ride ${rideId}`);


      io.to(`user:${riderId}`).emit('ride:driver_found', {
        rideId,
        driverId: id,
      });
    });

    socket.on('driver:arriving', ({ rideId, riderId }) => {
      if (role !== 'driver') return;
      io.to(`user:${riderId}`).emit('ride:driver_arriving', { rideId });
    });

    socket.on('driver:started_ride', ({ rideId, riderId }) => {
      if (role !== 'driver') return;
      io.to(`user:${riderId}`).emit('ride:started', { rideId });
    });

    socket.on('driver:completed_ride', ({ rideId, riderId }) => {
      if (role !== 'driver') return;
      io.to(`user:${riderId}`).emit('ride:completed', { rideId });
      socket.leave(`tracking:${id}`);
    });


    socket.on('chat:send', ({ rideId, recipientId, message }) => {
      io.to(`user:${recipientId}`).emit('chat:message', {
        rideId,
        senderId: id,
        senderRole: role,
        message,
        timestamp: Date.now(),
      });
    });


    socket.on('ride:cancel', ({ rideId, recipientId, reason }) => {
      io.to(`user:${recipientId}`).emit('ride:cancelled', {
        rideId,
        reason,
        cancelledBy: role,
      });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket] ${role} disconnected: ${id} — ${reason}`);
    });
  });


  return io;
};

module.exports = { setupSocket };
