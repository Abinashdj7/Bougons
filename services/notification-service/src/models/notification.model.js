const mongoose = require('mongoose');

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'ride_confirmed', 'driver_arriving', 'ride_started',
        'ride_completed', 'payment_received', 'ride_cancelled',
        'new_message', 'rating_received', 'promo',
      ],
      required: true,
    },
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    data:     { type: Schema.Types.Mixed, default: {} },
    channels: [{ type: String, enum: ['inapp', 'email', 'push'] }],
    status: {
      inapp: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      email: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
      push:  { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    },
    read:   { type: Boolean, default: false },
    readAt: { type: Date,    default: null  },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);