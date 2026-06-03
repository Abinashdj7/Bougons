const User = require('../models/user.model');
const Driver = require('../models/driver.model');
const {
  generateTokens,
  verifyRefreshToken,
  saveRefreshToken,
  blacklistToken,
  deleteRefreshToken,
} = require('../utils/jwt');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, phone, role });

    if (role === 'driver') {
      await Driver.create({ userId: user._id });
    }

    const { accessToken, refreshToken } = generateTokens({
      id: user._id,
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`New user registered: ${email} (${role})`);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, accessToken },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens({
      id: user._id,
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    user.password = undefined;

    logger.info(`User logged in: ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, accessToken },
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    const decoded = verifyRefreshToken(token);

    const redis = getRedis();
    const storedToken = await redis.get(`refresh:${decoded.id}`);
    if (storedToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: user._id,
      role: user.role,
    });

    await saveRefreshToken(user._id.toString(), newRefreshToken);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {

    await blacklistToken(req.token, 15 * 60);

    await deleteRefreshToken(req.user._id.toString());

    res.clearCookie('refreshToken');

    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({ success: true, data: { user: req.user } });
};

module.exports = { register, login, refresh, logout, getMe };
