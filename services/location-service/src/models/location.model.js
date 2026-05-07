const mongoose = require('mongoose');

const { Schema } = mongoose;


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
        type: [Number],
        required: true,
      },
    },
    heading:  { type: Number, default: 0 },
    speed:    { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

driverLocationSchema.index({ location: '2dsphere' });
driverLocationSchema.index({ isOnline: 1 });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);
