const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
  createIntent, confirmPayment, refundPayment,
  getHistory, getEarnings, getRevenue, handleWebhook,
} = require('../controllers/payment.controller');


router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

router.post('/intent',       authenticate, authorize('rider'),  createIntent);
router.post('/confirm',      authenticate,                      confirmPayment);
router.post('/:id/refund',   authenticate, authorize('admin'),  refundPayment);
router.get('/history',       authenticate,                      getHistory);
router.get('/earnings',      authenticate, authorize('driver'), getEarnings);
router.get('/revenue',       authenticate, authorize('admin'),  getRevenue);

module.exports = router;
