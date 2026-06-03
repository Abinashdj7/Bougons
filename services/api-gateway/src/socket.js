const { Server } = require('socket.io');
const jwt    = require('jsonwebtoken');
const axios  = require('axios');
const { logger } = require('./utils/logger');

const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://bougons-location:4003';
const RIDE_SERVICE_URL     = process.env.RIDE_SERVICE_URL     || 'http://bougons-ride-service:4002';

// ── Internal service helpers ───────────────────────────────────────────────────
// Service-to-service calls use the shared INTERNAL_SECRET, not user JWTs,
// so they never expire and the raw user token is never stored on the socket.
const internalHeaders = () => ({ 'x-internal-secret': process.env.INTERNAL_SECRET });

const setDriverStatus = (driverId, isOnline) =>
  axios.put(
    `${LOCATION_SERVICE_URL}/internal/drivers/${driverId}/status`,
    { isOnline },
    { headers: internalHeaders() }
  );

const persistDriverLocation = (driverId, coordinates, heading, speed) =>
  axios.put(
    `${LOCATION_SERVICE_URL}/internal/drivers/${driverId}/location`,
    { coordinates, heading, speed },
    { headers: internalHeaders() }
  );

// ─────────────────────────────────────────────────────────────────────────────

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

  // Auth middleware — verify JWT once at connect time; store only id + role
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

    // Wraps a handler so it silently no-ops for any role other than 'driver',
    // avoiding the repeated `if (role !== 'driver') return` guard everywhere.
    const onlyDriver = (handler) => async (...args) => {
      if (role !== 'driver') return;
      return handler(...args);
    };

    // Tracks whether the driver explicitly went offline this session.
    // Prevents the disconnect handler from sending a duplicate PUT when the
    // driver has already called driver:offline before disconnecting.
    let explicitlyOffline = false;

    // ── Rider events ──────────────────────────────────────────────────────────
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

    // ── Driver events ─────────────────────────────────────────────────────────
    socket.on('driver:location_update', onlyDriver(async ({ coordinates, heading = 0, speed = 0 }) => {
      // Fan-out real-time position to riders watching this driver
      socket.to(`tracking:${id}`).emit('driver:location', {
        driverId: id, coordinates, heading, speed, timestamp: Date.now(),
      });
      // Persist to DB/Redis so the location-service stays current during active rides
      try {
        await persistDriverLocation(id, coordinates, heading, speed);
      } catch (err) {
        logger.error(`[Socket] Failed to persist location for driver ${id}: ${err.message}`);
      }
    }));

    socket.on('driver:online', onlyDriver(async () => {
      try {
        await setDriverStatus(id, true);
        explicitlyOffline = false;
        socket.emit('driver:status', { isOnline: true });
        logger.info(`[Socket] Driver ${id} is now online`);
      } catch (err) {
        logger.error(`[Socket] Failed to set driver ${id} online: ${err.message}`);
      }
    }));

    socket.on('driver:offline', onlyDriver(async () => {
      try {
        await setDriverStatus(id, false);
        explicitlyOffline = true;
        socket.emit('driver:status', { isOnline: false });
        logger.info(`[Socket] Driver ${id} is now offline`);
      } catch (err) {
        logger.error(`[Socket] Failed to set driver ${id} offline: ${err.message}`);
      }
    }));

    socket.on('driver:accept_ride', onlyDriver(({ rideId, riderId }) => {
      logger.info(`[Socket] Driver ${id} accepted ride ${rideId}`);
      io.to(`user:${riderId}`).emit('ride:driver_found', { rideId, driverId: id });
    }));

    socket.on('driver:arriving', onlyDriver(({ rideId, riderId }) => {
      io.to(`user:${riderId}`).emit('ride:driver_arriving', { rideId });
    }));

    socket.on('driver:started_ride', onlyDriver(({ rideId, riderId }) => {
      io.to(`user:${riderId}`).emit('ride:started', { rideId });
    }));

    socket.on('driver:completed_ride', onlyDriver(({ rideId, riderId }) => {
      io.to(`user:${riderId}`).emit('ride:completed', { rideId });
      socket.leave(`tracking:${id}`);
    }));

    // ── Shared events ─────────────────────────────────────────────────────────
    socket.on('chat:send', ({ rideId, recipientId, message }) => {
      io.to(`user:${recipientId}`).emit('chat:message', {
        rideId, senderId: id, senderRole: role, message, timestamp: Date.now(),
      });
    });

    socket.on('ride:cancel', ({ rideId, recipientId, reason }) => {
      io.to(`user:${recipientId}`).emit('ride:cancelled', {
        rideId, reason, cancelledBy: role,
      });
    });

    socket.on('disconnect', async (reason) => {
      logger.info(`[Socket] ${role} disconnected: ${id} — ${reason}`);
      // Skip the PUT if the driver already called driver:offline explicitly,
      // preventing a duplicate request on a clean logout + disconnect sequence.
      if (role === 'driver' && !explicitlyOffline) {
        try {
          await setDriverStatus(id, false);
        } catch (err) {
          logger.error(`[Socket] Failed to set driver ${id} offline on disconnect: ${err.message}`);
        }
      }
    });
  });

  return io;
};

module.exports = { setupSocket };
