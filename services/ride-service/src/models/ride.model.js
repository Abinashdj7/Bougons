const mongoose = require('mongoose');

const { Schema } = mongoose;

const rideSchema = new Schema(
  {
    rider: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    driver: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'searching',      // looking for a driver
        'accepted',       // driver accepted
        'driver_arriving',// driver on the way
        'in_progress',    // ride started
        'completed',      // ride finished
        'cancelled',      // cancelled by rider or driver
      ],
      default: 'searching',
    },
    pickup: {
      address: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }, // [lng, lat]
      },
    },
    destination: {
      address: { type: String, required: true },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },
    fare: {
      estimated:       { type: Number, required: true },
      actual:          { type: Number, default: null },
      surgeMultiplier: { type: Number, default: 1.0 },
      currency:        { type: String, default: 'EUR' },
      breakdown: {
        baseFare:      Number,
        distanceFare:  Number,
        timeFare:      Number,
      },
    },
    distance: { type: Number },  // km
    duration: { type: Number },  // estimated minutes
    payment: {
      method: { type: String, enum: ['card', 'cash'], default: 'card' },
      status: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
      stripePaymentIntentId: { type: String, default: null },
    },
    rating: {
      fromRider:     { type: Number, min: 1, max: 5, default: null },
      fromDriver:    { type: Number, min: 1, max: 5, default: null },
      riderComment:  { type: String, default: null },
      driverComment: { type: String, default: null },
    },
    cancelReason: { type: String, default: null },
    startedAt:    { type: Date, default: null },
    completedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

rideSchema.index({ 'pickup.location': '2dsphere' });
rideSchema.index({ rider: 1, status: 1 });
rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ride', rideSchema);