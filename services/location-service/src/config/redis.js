const { createClient } = require('redis');
const { logger } = require('../utils/logger');

let client;

const connectRedis = async () => {
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  client.on('connect', () => logger.info('Redis connected'));
  await client.connect();
};

const getRedis = () => {
  if (!client) throw new Error('Redis not initialized');
  return client;
};

module.exports = { connectRedis, getRedis };
