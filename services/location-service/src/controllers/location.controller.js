const locationService = require('../services/location.service');


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


const getNearbyDrivers = async (req, res, next) => {
  try {
    const lngVal = parseFloat(req.query.lng);
    const latVal = parseFloat(req.query.lat);

    if (isNaN(lngVal) || isNaN(latVal) || lngVal < -180 || lngVal > 180 || latVal < -90 || latVal > 90) {
      return res.status(400).json({ success: false, message: 'Valid lng (-180–180) and lat (-90–90) are required' });
    }

    const maxDistance = Math.min(parseInt(req.query.maxDistance) || 5000, 50000);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const drivers = await locationService.findNearbyDrivers({
      lng: lngVal, lat: latVal, maxDistance, limit,
    });

    res.status(200).json({ success: true, data: { drivers } });
  } catch (error) {
    next(error);
  }
};


const getDriverLocation = async (req, res, next) => {
  try {
    const { id: requesterId, role } = req.user;
    if (role !== 'admin' && requesterId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const location = await locationService.getDriverLocation(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Driver location not found' });
    }
    res.status(200).json({ success: true, data: { location } });
  } catch (error) {
    next(error);
  }
};


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
