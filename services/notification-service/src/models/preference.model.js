const mongoose = require('mongoose');

const { Schema } = mongoose;

const preferenceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
    },
    channels: {
      inapp: { type: Boolean, default: true  },
      email: { type: Boolean, default: true  },
      push:  { type: Boolean, default: true  },
    },
    types: {
      ride_updates: { type: Boolean, default: true  },
      payments:     { type: Boolean, default: true  },
      promotions:   { type: Boolean, default: false },
      messages:     { type: Boolean, default: true  },
    },
    // Web Push subscription object from browser
    pushSubscription: { type: Schema.Types.Mixed, default: null },
    email: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Preference', preferenceSchema);