const Stripe  = require('stripe');
const Payment = require('../models/payment.model');
const axios   = require('axios');
const { logger } = require('../utils/logger');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://bougons-notification:4005';
const INTERNAL_SECRET          = process.env.INTERNAL_SECRET;

const notify = async (recipientId, type, data) => {
  try {
    await axios.post(`${NOTIFICATION_SERVICE_URL}/internal/send`, {
      recipientId, type, data,
      channels: ['inapp', 'email'],
    }, {
      headers: { 'x-internal-secret': INTERNAL_SECRET },
    });
  } catch (err) {
    logger.error(`Notification failed: ${err.message}`);
  }
};


const createPaymentIntent = async ({ rideId, riderId, driverId, amount }) => {
  const existing = await Payment.findOne({ rideId });
  if (existing) return existing;

  const amountInCents = Math.round(amount * 100);

  const intent = await stripe.paymentIntents.create({
    amount:   amountInCents,
    currency: 'eur',
    metadata: { rideId: rideId.toString(), riderId: riderId.toString() },
    automatic_payment_methods: { enabled: true },
  });

  const payment = await Payment.create({
    rideId,
    riderId,
    driverId,
    amount,
    stripePaymentIntentId: intent.id,
    status: 'pending',
  });

  return { payment, clientSecret: intent.client_secret };
};


const confirmPayment = async (paymentIntentId) => {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  const payment = await Payment.findOneAndUpdate(
    { stripePaymentIntentId: paymentIntentId },
    {
      status: intent.status === 'succeeded' ? 'succeeded' : 'failed',
      stripeChargeId: intent.latest_charge,
    },
    { new: true }
  );

  if (!payment) throw new Error('Payment not found');

  if (intent.status === 'succeeded') {
    await notify(payment.riderId.toString(), 'payment_received', {
      amount: payment.amount,
    });
    logger.info(`Payment confirmed: ${payment._id}`);
  }

  return payment;
};


const refundPayment = async (paymentId, reason) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'succeeded') throw new Error('Payment not eligible for refund');

  const refund = await stripe.refunds.create({
    charge: payment.stripeChargeId,
    reason: 'requested_by_customer',
  });

  await payment.updateOne({
    status: 'refunded',
    'refund.amount':         payment.amount,
    'refund.reason':         reason,
    'refund.stripeRefundId': refund.id,
    'refund.createdAt':      new Date(),
  });

  logger.info(`Refund processed: ${refund.id}`);
  return refund;
};


const getPaymentHistory = async (userId, role, page = 1, limit = 10) => {
  const query = role === 'rider' ? { riderId: userId } : { driverId: userId };
  return Payment.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));
};


const getDriverEarnings = async (driverId) => {
  const payments = await Payment.find({
    driverId,
    status: 'succeeded',
  });

  const total = payments.reduce((sum, p) => sum + p.amount, 0);


  const byDay = payments.reduce((acc, p) => {
    const day = p.createdAt.toISOString().split('T')[0];
    acc[day] = (acc[day] || 0) + p.amount;
    return acc;
  }, {});

  return { total, byDay, count: payments.length };
};


const getPlatformRevenue = async () => {
  const result = await Payment.aggregate([
    { $match: { status: 'succeeded' } },
    {
      $group: {
        _id:      null,
        total:    { $sum: '$amount' },
        count:    { $sum: 1 },
        avgFare:  { $avg: '$amount' },
      },
    },
  ]);
  return result[0] || { total: 0, count: 0, avgFare: 0 };
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  refundPayment,
  getPaymentHistory,
  getDriverEarnings,
  getPlatformRevenue,
};
