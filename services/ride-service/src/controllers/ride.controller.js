const rideService = require('../services/ride.service');
const Ride = require('../models/ride.model');

// POST /api/rides — request a ride
const requestRide = async (req, res, next) => {
  try {
    const { pickup, destination, paymentMethod } = req.body;

    if (!pickup?.location?.coordinates || !destination?.location?.coordinates) {
      return res.status(400).json({ success: false, message: 'Pickup and destination coordinates required' });
    }

    const { ride, fareData } = await rideService.requestRide({
      riderId: req.user.id,
      pickup,
      destination,
      paymentMethod,
    });

    res.status(201).json({ success: true, data: { ride, fareData } });
  } catch (error) {
    next(error);
  }
};

// GET /api/rides/estimate — fare estimate without creating a ride
const getEstimate = async (req, res, next) => {
  try {
    const { pickupLng, pickupLat, destLng, destLat } = req.query;

    if (!pickupLng || !pickupLat || !destLng || !destLat) {
      return res.status(400).json({ success: false, message: 'Coordinates required' });
    }

    const Ride = require('../models/ride.model');
    const { calculateFare, getSurgeMultiplier } = require('../utils/fareCalculator');

    const activeRides = await Ride.countDocuments({
      status: { $in: ['searching', 'accepted', 'in_progress'] },
    });

    const surgeMultiplier = getSurgeMultiplier(activeRides);
    const fareData = calculateFare(
      [parseFloat(pickupLng), parseFloat(pickupLat)],
      [parseFloat(destLng), parseFloat(destLat)],
      surgeMultiplier
    );

    res.status(200).json({ success: true, data: fareData });
  } catch (error) {
    next(error);
  }
};

// GET /api/rides — ride history for rider or driver
const getRideHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = req.user.role === 'rider'
      ? { rider: req.user.id }
      : { driver: req.user.id };

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      data: { rides, total, page: parseInt(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/rides/:id
const getRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

    const isOwner =
      String(ride.rider) === req.user.id ||
      String(ride.driver) === req.user.id ||
      req.user.role === 'admin';

    if (!isOwner) return res.status(403).json({ success: false, message: 'Access denied' });

    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/rides/:id/accept — driver accepts
const acceptRide = async (req, res, next) => {
  try {
    const ride = await rideService.acceptRide(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/rides/:id/arriving — driver is arriving
const driverArriving = async (req, res, next) => {
  try {
    const ride = await rideService.driverArriving(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/rides/:id/start — driver starts ride
const startRide = async (req, res, next) => {
  try {
    const ride = await rideService.startRide(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/rides/:id/complete — driver completes ride
const completeRide = async (req, res, next) => {
  try {
    const ride = await rideService.completeRide(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/rides/:id/cancel
const cancelRide = async (req, res, next) => {
  try {
    const ride = await rideService.cancelRide(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body.reason
    );
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

// POST /api/rides/:id/rate
const submitRating = async (req, res, next) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Score must be between 1 and 5' });
    }
    const ride = await rideService.submitRating(req.params.id, req.user.id, req.user.role, score, comment);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestRide,
  getEstimate,
  getRideHistory,
  getRide,
  acceptRide,
  driverArriving,
  startRide,
  completeRide,
  cancelRide,
  submitRating,
};