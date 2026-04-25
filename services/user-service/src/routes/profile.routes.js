const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateDriverProfile,
  toggleDriverStatus,
  getDriverById,
} = require('../controllers/profile.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate, updateProfileSchema, updateDriverSchema } = require('../utils/validation');

router.get('/',                authenticate, getProfile);
router.put('/',                authenticate, validate(updateProfileSchema), updateProfile);
router.put('/driver',          authenticate, authorize('driver'), validate(updateDriverSchema), updateDriverProfile);
router.put('/driver/status',   authenticate, authorize('driver'), toggleDriverStatus);
router.get('/drivers/:id',     authenticate, getDriverById);

module.exports = router;
