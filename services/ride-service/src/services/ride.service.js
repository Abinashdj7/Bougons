const axios = require('axios');
const Ride = require('../models/ride.js');
const { calculateFare, getSurgeMultiplier } = require('../utils/fareCalculator.js');
const { logger } = require('../utils/logger.js');

const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://location-service:4003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';

// ─── Notify other services (fire and forget) ──────────────────
const notify = async (recipientId, type, data = {}) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/internal/send`, {
      recipientId,
      type,
      data,
    });
  } catch (err) {
    logger.error(`Notification failed: ${err.message}`);
  }
};

// ─── Find nearest available driver ───────────────────────────
const findNearestDriver = async (pickupCoordinates) => {
  try {
    const { data } = await axios.get(`${LOCATION_SERVICE_URL}/api/location/drivers/nearby`, {
      params: {
        lng: pickupCoordinates[0],
        lat: pickupCoordinates[1],
        maxDistance: 5000, // 5km radius
      },
    });
    return data.data.drivers[0] || null; // closest driver
  } catch (err) {
    logger.error(`Failed to find driver: ${err.message}`);
    return null;
  }
};

// ─── Request a ride ───────────────────────────────────────────
const requestRide = async ({ riderId, pickup, destination, paymentMethod }) => {
  // Count active rides for surge pricing
  const activeRides = await Ride.countDocuments({
    status: { $in: ['searching', 'accepted', 'in_progress'] },
  });

  const surgeMultiplier = getSurgeMultiplier(activeRides);
  const fareData = calculateFare(pickup.location.coordinates, destination.location.coordinates, surgeMultiplier);

  const ride = await Ride.create({
    rider: riderId,
    pickup,
    destination,
    fare: {
      estimated: fareData.estimated,
      surgeMultiplier: fareData.surgeMultiplier,
      breakdown: fareData.breakdown,
    },
    distance: fareData.distance,
    duration: fareData.duration,
    payment: { method: paymentMethod || 'card' },
  });

  return { ride, fareData };
};

// ─── Driver accepts ride ──────────────────────────────────────
const acceptRide = async (rideId, driverId) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: 'searching' },
    { driver: driverId, status: 'accepted' },
    { new: true }
  );

  if (!ride) throw new Error('Ride not available');

  await notify(ride.rider.toString(), 'ride_confirmed', {
    rideId: ride._id,
    driverId,
  });

  return ride;
};

// ─── Driver marks as arriving ─────────────────────────────────
const driverArriving = async (rideId, driverId) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, status: 'accepted' },
    { status: 'driver_arriving' },
    { new: true }
  );

  if (!ride) throw new Error('Ride not found or invalid status');

  await notify(ride.rider.toString(), 'driver_arriving', { rideId: ride._id });

  return ride;
};

// ─── Start ride ───────────────────────────────────────────────
const startRide = async (rideId, driverId) => {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, status: 'driver_arriving' },
    { status: 'in_progress', startedAt: new Date() },
    { new: true }
  );

  if (!ride) throw new Error('Ride not found or invalid status');

  await notify(ride.rider.toString(), 'ride_started', { rideId: ride._id });

  return ride;
};

// ─── Complete ride ────────────────────────────────────────────
const completeRide = async (rideId, driverId) => {
  const ride = await Ride.findOne({ _id: rideId, driver: driverId, status: 'in_progress' });
  if (!ride) throw new Error('Ride not found or invalid status');

  ride.status = 'completed';
  ride.completedAt = new Date();
  ride.fare.actual = ride.fare.estimated; // Stripe will handle actual in Phase 4
  ride.payment.status = 'paid';

  await ride.save();

  await notify(ride.rider.toString(), 'ride_completed', {
    rideId: ride._id,
    fare: ride.fare.actual,
  });

  return ride;
};

// ─── Cancel ride ──────────────────────────────────────────────
const cancelRide = async (rideId, userId, role, reason) => {
  const query = { _id: rideId, status: { $in: ['searching', 'accepted', 'driver_arriving'] } };

  if (role === 'rider') query.rider = userId;
  if (role === 'driver') query.driver = userId;

  const ride = await Ride.findOneAndUpdate(
    query,
    { status: 'cancelled', cancelReason: reason || 'No reason provided' },
    { new: true }
  );

  if (!ride) throw new Error('Ride not found or cannot be cancelled');

  // Notify the other party
  const notifyId = role === 'rider'
    ? ride.driver?.toString()
    : ride.rider.toString();

  if (notifyId) {
    await notify(notifyId, 'ride_cancelled', { rideId: ride._id, reason: ride.cancelReason });
  }

  return ride;
};

// ─── Submit rating ────────────────────────────────────────────
const submitRating = async (rideId, userId, role, score, comment) => {
  const ride = await Ride.findOne({ _id: rideId, status: 'completed' });
  if (!ride) throw new Error('Ride not found or not completed');

  if (role === 'rider' && String(ride.rider) === userId) {
    ride.rating.fromRider = score;
    ride.rating.riderComment = comment;
  } else if (role === 'driver' && String(ride.driver) === userId) {
    ride.rating.fromDriver = score;
    ride.rating.driverComment = comment;
  } else {
    throw new Error('Not authorized to rate this ride');
  }

  await ride.save();
  return ride;
};

module.exports = {
  requestRide,
  acceptRide,
  driverArriving,
  startRide,
  completeRide,
  cancelRide,
  submitRating,
  findNearestDriver,
};