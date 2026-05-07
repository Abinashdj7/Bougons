const axios = require('axios');
const Ride = require('../models/ride.model.js');
const { calculateFare, getSurgeMultiplier } = require('../utils/fareCalculator.js');
const { logger } = require('../utils/logger.js');

const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://location-service:4003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';


const notify = async (recipientId, type, data = {}) => {
  try {
    if (!recipientId) {
      logger.warn('Notification skipped: no recipientId');
      return;
    }
    await axios.post(`${NOTIFICATION_SERVICE_URL}/internal/send`, {
      recipientId,
      type,
      data,
    });
  } catch (err) {
    logger.error(`Notification failed: ${err.message}`);

  }
};


const findNearestDriver = async (pickupCoordinates) => {
  try {
    const { data } = await axios.get(`${LOCATION_SERVICE_URL}/api/location/drivers/nearby`, {
      params: {
        lng: pickupCoordinates[0],
        lat: pickupCoordinates[1],
        maxDistance: 5000,
      },
    });
    return data.data.drivers[0] || null;
  } catch (err) {
    logger.error(`Failed to find driver: ${err.message}`);
    return null;
  }
};


const requestRide = async ({ riderId, pickup, destination, paymentMethod }) => {
  if (!riderId) {
    throw new Error('Rider ID is required');
  }


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

  logger.info(`Ride created: ${ride._id} for rider ${riderId}`);
  return { ride, fareData };
};


const acceptRide = async (rideId, driverId) => {
  if (!rideId || !driverId) {
    throw new Error('Ride ID and Driver ID are required');
  }

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: 'searching' },
    { driver: driverId, status: 'accepted' },
    { new: true }
  );

  if (!ride) {
    throw new Error('Ride not available or already accepted');
  }

  logger.info(`Ride ${rideId} accepted by driver ${driverId}`);

  await notify(ride.rider.toString(), 'ride_confirmed', {
    rideId: ride._id,
    driverId,
  });

  return ride;
};


const driverArriving = async (rideId, driverId) => {
  if (!rideId || !driverId) {
    throw new Error('Ride ID and Driver ID are required');
  }

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, status: 'accepted' },
    { status: 'driver_arriving' },
    { new: true }
  );

  if (!ride) {
    throw new Error('Ride not found or invalid status transition');
  }

  logger.info(`Driver ${driverId} arriving for ride ${rideId}`);

  await notify(ride.rider.toString(), 'driver_arriving', { rideId: ride._id });

  return ride;
};


const startRide = async (rideId, driverId) => {
  if (!rideId || !driverId) {
    throw new Error('Ride ID and Driver ID are required');
  }

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, driver: driverId, status: 'driver_arriving' },
    { status: 'in_progress', startedAt: new Date() },
    { new: true }
  );

  if (!ride) {
    throw new Error('Ride not found or invalid status transition');
  }

  logger.info(`Ride ${rideId} started`);

  await notify(ride.rider.toString(), 'ride_started', { rideId: ride._id });

  return ride;
};


const completeRide = async (rideId, driverId) => {
  if (!rideId || !driverId) {
    throw new Error('Ride ID and Driver ID are required');
  }

  const ride = await Ride.findOne({ _id: rideId, driver: driverId, status: 'in_progress' });
  if (!ride) {
    throw new Error('Ride not found or not in progress');
  }

  ride.status = 'completed';
  ride.completedAt = new Date();
  ride.fare.actual = ride.fare.estimated;
  ride.payment.status = 'paid';

  await ride.save();

  logger.info(`Ride ${rideId} completed`);

  await notify(ride.rider.toString(), 'ride_completed', {
    rideId: ride._id,
    fare: ride.fare.actual,
  });

  return ride;
};


const cancelRide = async (rideId, userId, role, reason) => {
  if (!rideId || !userId || !role) {
    throw new Error('Ride ID, User ID, and Role are required');
  }

  const query = { _id: rideId, status: { $in: ['searching', 'accepted', 'driver_arriving'] } };

  if (role === 'rider') {
    query.rider = userId;
  } else if (role === 'driver') {
    query.driver = userId;
  } else {
    throw new Error('Invalid role for cancellation');
  }

  const ride = await Ride.findOneAndUpdate(
    query,
    { status: 'cancelled', cancelReason: reason || 'No reason provided' },
    { new: true }
  );

  if (!ride) {
    throw new Error('Ride not found or cannot be cancelled in current status');
  }

  logger.info(`Ride ${rideId} cancelled by ${role} ${userId}: ${reason}`);


  const notifyId = role === 'rider'
    ? ride.driver?.toString()
    : ride.rider.toString();

  if (notifyId) {
    await notify(notifyId, 'ride_cancelled', { rideId: ride._id, reason: ride.cancelReason });
  }

  return ride;
};


const submitRating = async (rideId, userId, role, score, comment) => {
  if (!rideId || !userId || !role || score === undefined) {
    throw new Error('Ride ID, User ID, Role, and Score are required');
  }

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be an integer between 1 and 5');
  }

  const ride = await Ride.findOne({ _id: rideId, status: 'completed' });
  if (!ride) {
    throw new Error('Ride not found or not completed');
  }

  if (role === 'rider' && String(ride.rider) === userId) {
    ride.rating.fromRider = score;
    ride.rating.riderComment = comment || null;
  } else if (role === 'driver' && String(ride.driver) === userId) {
    ride.rating.fromDriver = score;
    ride.rating.driverComment = comment || null;
  } else {
    throw new Error('Not authorized to rate this ride');
  }

  await ride.save();

  logger.info(`Rating submitted for ride ${rideId}: ${score} stars from ${role}`);

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
