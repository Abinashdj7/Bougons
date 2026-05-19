const rideService = require('../services/ride.service');
const Ride = require('../models/ride.model');


const requestRide = async (req, res, next) => {
  try {
    const { pickup, destination, paymentMethod } = req.body;

    if (!pickup?.location?.coordinates || !destination?.location?.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: pickup and destination with coordinates required'
      });
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


const getEstimate = async (req, res, next) => {
  try {
    const { pickupLng, pickupLat, destLng, destLat } = req.query;

    if (!pickupLng || !pickupLat || !destLng || !destLat) {
      return res.status(400).json({
        success: false,
        message: 'Missing required coordinates: pickupLng, pickupLat, destLng, destLat'
      });
    }


    const coords = [pickupLng, pickupLat, destLng, destLat].map(parseFloat);
    if (coords.some(isNaN)) {
      return res.status(400).json({
        success: false,
        message: 'All coordinates must be valid numbers'
      });
    }

    const activeRides = await Ride.countDocuments({
      status: { $in: ['searching', 'accepted', 'in_progress'] },
    });

    const { calculateFare, getSurgeMultiplier } = require('../utils/fareCalculator');

    const surgeMultiplier = getSurgeMultiplier(activeRides);
    const fareData = calculateFare(
      [coords[0], coords[1]],
      [coords[2], coords[3]],
      surgeMultiplier
    );

    res.status(200).json({ success: true, data: fareData });
  } catch (error) {
    next(error);
  }
};


const getRideHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const query = req.user.role === 'rider'
      ? { rider: req.user.id }
      : { driver: req.user.id };

    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        rides,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
    });
  } catch (error) {
    next(error);
  }
};


const getRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const isOwner =
      String(ride.rider) === req.user.id ||
      (ride.driver && String(ride.driver) === req.user.id) ||
      req.user.role === 'admin';

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    next(error);
  }
};


const acceptRide = async (req, res, next) => {
  try {
    const ride = await rideService.acceptRide(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    if (error.message.includes('not available')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};


const driverArriving = async (req, res, next) => {
  try {
    const ride = await rideService.driverArriving(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    if (error.message.includes('invalid status')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};


const startRide = async (req, res, next) => {
  try {
    const ride = await rideService.startRide(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    if (error.message.includes('invalid status')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};


const completeRide = async (req, res, next) => {
  try {
    const ride = await rideService.completeRide(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    if (error.message.includes('invalid status')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};


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
    if (error.message.includes('cannot be cancelled')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};


const submitRating = async (req, res, next) => {
  try {
    const { score, comment } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ success: false, message: 'Score is required' });
    }

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Score must be an integer between 1 and 5' });
    }

    const ride = await rideService.submitRating(req.params.id, req.user.id, req.user.role, score, comment);
    res.status(200).json({ success: true, data: { ride } });
  } catch (error) {
    if (error.message.includes('Not authorized')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes('not completed')) {
      return res.status(409).json({ success: false, message: error.message });
    }
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
