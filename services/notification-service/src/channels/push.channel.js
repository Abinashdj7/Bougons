const webpush = require('web-push');
const { logger } = require('../utils/logger');

const init = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:hello@bougons.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    logger.info('Web Push initialized');
  } else {
    logger.warn('Push skipped: VAPID keys not configured');
  }
};

const sendPush = async (subscription, payload) => {
  if (!subscription || !process.env.VAPID_PUBLIC_KEY) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    logger.error(`Push failed: ${err.message}`);
    return false;
  }
};

module.exports = { init, sendPush };
