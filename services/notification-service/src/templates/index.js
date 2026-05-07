const templates = {
  ride_confirmed: ({ driverId }) => ({
    title: '🚗 Driver found!',
    body:  'Your driver is on the way. Track them live on the map.',
    email: {
      subject: 'Your Bougons driver is confirmed',
      html: `<h2>Your driver is confirmed!</h2><p>Track your driver live in the app.</p>`,
    },
  }),

  driver_arriving: () => ({
    title: '📍 Driver is arriving',
    body:  'Your driver has reached the pickup point. Please head outside.',
    email: {
      subject: 'Your driver has arrived',
      html: `<h2>Your driver is here!</h2><p>Please head to your pickup location.</p>`,
    },
  }),

  ride_started: () => ({
    title: '▶️ Ride started',
    body:  'Your ride is now in progress. Sit back and relax!',
    email: null,
  }),

  ride_completed: ({ fare }) => ({
    title: '🏁 You have arrived!',
    body:  `Your ride is complete. Total: €${fare}. Thank you for riding with Bougons!`,
    email: {
      subject: 'Your Bougons ride receipt',
      html: `<h2>Ride complete!</h2><p>Total charged: <strong>€${fare}</strong></p><p>Thank you for riding with Bougons!</p>`,
    },
  }),

  ride_cancelled: ({ reason }) => ({
    title: '❌ Ride cancelled',
    body:  `Your ride was cancelled. Reason: ${reason}`,
    email: {
      subject: 'Your Bougons ride was cancelled',
      html: `<h2>Ride cancelled</h2><p>Reason: ${reason}</p><p>You can book a new ride anytime.</p>`,
    },
  }),

  payment_received: ({ amount }) => ({
    title: '💳 Payment received',
    body:  `€${amount} has been charged to your card.`,
    email: {
      subject: 'Payment confirmation - Bougons',
      html: `<h2>Payment confirmed</h2><p>Amount: <strong>€${amount}</strong></p>`,
    },
  }),

  new_message: ({ senderName }) => ({
    title: `💬 New message`,
    body:  `You have a new message during your ride.`,
    email: null,
  }),

  rating_received: ({ score }) => ({
    title: '⭐ New rating',
    body:  `You received a ${score}-star rating!`,
    email: null,
  }),

  promo: ({ text }) => ({
    title: '🎁 Special offer',
    body:  text || 'Check out our latest promotions!',
    email: {
      subject: 'Special offer from Bougons',
      html: `<h2>Special offer!</h2><p>${text}</p>`,
    },
  }),
};

const getTemplate = (type, data = {}) => {
  const fn = templates[type];
  if (!fn) throw new Error(`Unknown notification type: ${type}`);
  return fn(data);
};

module.exports = { getTemplate };
