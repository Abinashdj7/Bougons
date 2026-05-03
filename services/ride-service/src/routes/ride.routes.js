const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  requestRide, getEstimate, getRideHistory, getRide,
  acceptRide, driverArriving, startRide, completeRide,
  cancelRide, submitRating,
} = require('../controllers/ride.controller');

router.get('/estimate',       authenticate, getEstimate);
router.get('/',               authenticate, getRideHistory);
router.get('/:id',            authenticate, getRide);
router.post('/',              authenticate, authorize('rider'), requestRide);
router.put('/:id/accept',     authenticate, authorize('driver'), acceptRide);
router.put('/:id/arriving',   authenticate, authorize('driver'), driverArriving);
router.put('/:id/start',      authenticate, authorize('driver'), startRide);
router.put('/:id/complete',   authenticate, authorize('driver'), completeRide);
router.put('/:id/cancel',     authenticate, cancelRide);
router.post('/:id/rate',      authenticate, submitRating);

module.exports = router;