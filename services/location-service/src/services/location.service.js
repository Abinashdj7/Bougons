const DriverLocation = require('../models/location.model');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

const REDIS_LOCATION_TTL = 60;


const updateDriverLocation = async (driverId, { coordinates, heading, speed }) => {
  const redis = getRedis();

  const locationData = {
    driverId,
    coordinates,
    heading: heading || 0,
    speed: speed || 0,
    timestamp: Date.now(),
  };


  await redis.setEx(
    `driver:location:${driverId}`,
    REDIS_LOCATION_TTL,
    JSON.stringify(locationData)
  );


  await DriverLocation.findOneAndUpdate(
    { driverId },
    {
      location: { type: 'Point', coordinates },
      heading: heading || 0,
      speed: speed || 0,
      isOnline: true,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return locationData;
};


const getDriverLocation = async (driverId) => {
  const redis = getRedis();
  const cached = await redis.get(`driver:location:${driverId}`);
  if (cached) return JSON.parse(cached);


  const doc = await DriverLocation.findOne({ driverId });
  return doc ? { coordinates: doc.location.coordinates, heading: doc.heading } : null;
};


const findNearbyDrivers = async ({ lng, lat, maxDistance = 5000, limit = 10 }) => {
  const drivers = await DriverLocation.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distance',
        maxDistance: parseInt(maxDistance),
        spherical: true,
        query: { isOnline: true },
      },
    },
    { $limit: parseInt(limit) },
    {
      $project: {
        driverId: 1,
        distance: 1,
        coordinates: '$location.coordinates',
        heading: 1,
        speed: 1,
        updatedAt: 1,
      },
    },
  ]);

  return drivers;
};


const setDriverOnlineStatus = async (driverId, isOnline) => {
  const redis = getRedis();

  await DriverLocation.findOneAndUpdate(
    { driverId },
    { isOnline, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  if (!isOnline) {

    await redis.del(`driver:location:${driverId}`);
  }

  logger.info(`Driver ${driverId} is now ${isOnline ? 'online' : 'offline'}`);
};


const getOnlineDrivers = async () => {
  return DriverLocation.find({ isOnline: true }).lean();
};

module.exports = {
  updateDriverLocation,
  getDriverLocation,
  findNearbyDrivers,
  setDriverOnlineStatus,
  getOnlineDrivers,
};
