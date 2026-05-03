const locationService = require('../services/location.service');

// PUT /api/location/drivers/update — driver sends GPS position
const updateLocation = async (req, res, next) => {
  try {
    const { coordinates, heading, speed } = req.body;

    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'coordinates must be [longitude, latitude]',
      });
    }

    const data = await locationService.updateDriverLocation(req.user.id, {
      coordinates,
      heading,
      speed,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/location/drivers/nearby — find drivers near a point
const getNearbyDrivers = async (req, res, next) => {
  try {
    const { lng, lat, maxDistance, limit } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({
        success: false,
        message: 'lng and lat query params required',
      });
    }

    const drivers = await locationService.findNearbyDrivers({
      lng, lat, maxDistance, limit,
    });

    res.status(200).json({ success: true, data: { drivers } });
  } catch (error) {
    next(error);
  }
};

// GET /api/location/drivers/:id — get one driver's location
const getDriverLocation = async (req, res, next) => {
  try {
    const location = await locationService.getDriverLocation(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Driver location not found' });
    }
    res.status(200).json({ success: true, data: { location } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/location/drivers/status — toggle online/offline
const setOnlineStatus = async (req, res, next) => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isOnline must be a boolean' });
    }
    await locationService.setDriverOnlineStatus(req.user.id, isOnline);
    res.status(200).json({
      success: true,
      message: `You are now ${isOnline ? 'online' : 'offline'}`,
      data: { isOnline },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/location/drivers — all online drivers (admin)
const getOnlineDrivers = async (req, res, next) => {
  try {
    const drivers = await locationService.getOnlineDrivers();
    res.status(200).json({ success: true, data: { drivers, count: drivers.length } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateLocation,
  getNearbyDrivers,
  getDriverLocation,
  setOnlineStatus,
  getOnlineDrivers,
};