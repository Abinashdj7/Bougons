const User = require('../models/user.model');
const Driver = require('../models/driver.model');

// ─── Get Profile ──────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let driverProfile = null;

    if (user.role === 'driver') {
      driverProfile = await Driver.findOne({ userId: user._id });
    }

    return res.status(200).json({
      success: true,
      data: { user, driverProfile },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Profile ───────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'avatar'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Driver Profile ────────────────────────────────────
const updateDriverProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Not a driver account' });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Driver profile updated',
      data: { driver },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Toggle Driver Online Status ──────────────────────────────
const toggleDriverStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ success: false, message: 'Not a driver account' });
    }

    const driver = await Driver.findOne({ userId: req.user._id });
    driver.isOnline = !driver.isOnline;
    await driver.save();

    return res.status(200).json({
      success: true,
      message: `Driver is now ${driver.isOnline ? 'online' : 'offline'}`,
      data: { isOnline: driver.isOnline },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Driver by ID (public) ────────────────────────────────
const getDriverById = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name rating avatar');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    return res.status(200).json({ success: true, data: { driver } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateDriverProfile,
  toggleDriverStatus,
  getDriverById,
};
