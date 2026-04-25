const mongoose = require('mongoose');

const { Schema } = mongoose;

const driverSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vehicle: {
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      year: { type: Number },
      licensePlate: { type: String, trim: true, uppercase: true },
      color: { type: String, trim: true },
    },
    documents: {
      license: { type: String, default: null },
      insurance: { type: String, default: null },
      isVerified: { type: Boolean, default: false },
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    earnings: {
      today: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// ─── Geospatial Index ─────────────────────────────────────────
driverSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Driver', driverSchema);
