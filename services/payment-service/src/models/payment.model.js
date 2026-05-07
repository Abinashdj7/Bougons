const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    rideId:  { type: Schema.Types.ObjectId, required: true, index: true },
    riderId: { type: Schema.Types.ObjectId, required: true, index: true },
    driverId:{ type: Schema.Types.ObjectId, required: true },

    amount:   { type: Number, required: true },
    currency: { type: String, default: 'eur'  },

    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },


    stripePaymentIntentId: { type: String, default: null },
    stripeCustomerId:      { type: String, default: null },
    stripeChargeId:        { type: String, default: null },


    driverPayout: {
      amount: { type: Number, default: null },
      status: { type: String, enum: ['pending', 'paid', null], default: null },
      stripeTransferId: { type: String, default: null },
    },

    refund: {
      amount: { type: Number, default: null },
      reason: { type: String, default: null },
      stripeRefundId: { type: String, default: null },
      createdAt: { type: Date, default: null },
    },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
