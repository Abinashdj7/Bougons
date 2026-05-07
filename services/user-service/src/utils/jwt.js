const jwt = require('jsonwebtoken');
const { getRedis } = require('../config/redis');

const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const saveRefreshToken = async (userId, refreshToken) => {
  const redis = getRedis();
  await redis.setEx(`refresh:${userId}`, 7 * 24 * 60 * 60, refreshToken);
};

const blacklistToken = async (token, expiresIn) => {
  const redis = getRedis();
  await redis.setEx(`blacklist:${token}`, expiresIn, 'true');
};

const isTokenBlacklisted = async (token) => {
  const redis = getRedis();
  return await redis.exists(`blacklist:${token}`);
};

const deleteRefreshToken = async (userId) => {
  const redis = getRedis();
  await redis.del(`refresh:${userId}`);
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  saveRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
  deleteRefreshToken,
};
