const mongoose = require('mongoose');

const { Schema } = mongoose;

// Persisted snapshot of driver location — used for $geoNear queries
// Real-time updates go through Redis for speed, MongoDB for persistence
const driverLocationSchema = new Schema(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    heading:  { type: Number, default: 0 },   // degrees 0-360
    speed:    { type: Number, default: 0 },   // km/h
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

driverLocationSchema.index({ location: '2dsphere' });
driverLocationSchema.index({ isOnline: 1 });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);