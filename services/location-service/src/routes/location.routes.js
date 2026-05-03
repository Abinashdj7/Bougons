const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  updateLocation,
  getNearbyDrivers,
  getDriverLocation,
  setOnlineStatus,
  getOnlineDrivers,
} = require('../controllers/location.controller');

// Driver updates their GPS position (called every few seconds from driver app)
router.put('/drivers/update',  authenticate, authorize('driver'), updateLocation);

// Toggle online/offline
router.put('/drivers/status',  authenticate, authorize('driver'), setOnlineStatus);

// Find nearby drivers (called by ride-service for matching)
router.get('/drivers/nearby',  authenticate, getNearbyDrivers);

// Get a specific driver's location (called by rider app for live tracking)
router.get('/drivers/:id',     authenticate, getDriverLocation);

// All online drivers — admin only
router.get('/drivers',         authenticate, authorize('admin'), getOnlineDrivers);

module.exports = router;