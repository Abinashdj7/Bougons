const paymentService = require('../services/payment.service');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { logger } = require('../utils/logger');


const createIntent = async (req, res, next) => {
  try {
    const { rideId, driverId, amount } = req.body;
    if (!rideId || !amount) {
      return res.status(400).json({ success: false, message: 'rideId and amount required' });
    }
    const result = await paymentService.createPaymentIntent({
      rideId,
      riderId:  req.user.id,
      driverId,
      amount,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};


const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    const payment = await paymentService.confirmPayment(paymentIntentId);
    res.status(200).json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
};


const refundPayment = async (req, res, next) => {
  try {
    const refund = await paymentService.refundPayment(req.params.id, req.body.reason);
    res.status(200).json({ success: true, data: { refund } });
  } catch (err) {
    next(err);
  }
};


const getHistory = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const payments = await paymentService.getPaymentHistory(req.user.id, req.user.role, page, limit);
    res.status(200).json({ success: true, data: { payments } });
  } catch (err) {
    next(err);
  }
};


const getEarnings = async (req, res, next) => {
  try {
    const earnings = await paymentService.getDriverEarnings(req.user.id);
    res.status(200).json({ success: true, data: earnings });
  } catch (err) {
    next(err);
  }
};


const getRevenue = async (req, res, next) => {
  try {
    const revenue = await paymentService.getPlatformRevenue();
    res.status(200).json({ success: true, data: revenue });
  } catch (err) {
    next(err);
  }
};


const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error(`Webhook error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    await paymentService.confirmPayment(event.data.object.id);
  }

  res.json({ received: true });
};

module.exports = {
  createIntent,
  confirmPayment,
  refundPayment,
  getHistory,
  getEarnings,
  getRevenue,
  handleWebhook,
};
