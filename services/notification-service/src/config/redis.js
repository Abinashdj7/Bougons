const { logger } = require('../utils/logger');

// BullMQ requires ioredis
const Redis = require('ioredis');

let client;

const connectRedis = async () => {
  client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // required by BullMQ
  });
  client.on('connect', () => logger.info('Redis connected (ioredis)'));
  client.on('error',   (err) => logger.error(`Redis error: ${err.message}`));
};

const getRedis = () => {
  if (!client) throw new Error('Redis not initialized');
  return client;
};

module.exports = { connectRedis, getRedis };