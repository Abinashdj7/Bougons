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


router.put('/drivers/update',  authenticate, authorize('driver'), updateLocation);


router.put('/drivers/status',  authenticate, authorize('driver'), setOnlineStatus);


router.get('/drivers/nearby',  authenticate, getNearbyDrivers);


router.get('/drivers/:id',     authenticate, getDriverLocation);


router.get('/drivers',         authenticate, authorize('admin'), getOnlineDrivers);

module.exports = router;
