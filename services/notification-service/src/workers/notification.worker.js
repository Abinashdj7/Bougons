const { Worker } = require('bullmq');
const Notification = require('../models/notification.model');
const Preference   = require('../models/preference.model');
const { sendEmail }   = require('../channels/email.channel');
const { sendPush }    = require('../channels/push.channel');
const { sendToUser }  = require('../channels/inapp.channel');
const { getTemplate } = require('../templates');
const { getRedis }    = require('../config/redis');
const { logger }      = require('../utils/logger');

const processNotification = async (job) => {
  const { recipientId, type, data, channels, emailAddress } = job.data;

  logger.info(`Processing notification: ${type} for ${recipientId}`);

  // Get user preferences
  const prefs = await Preference.findOne({ userId: recipientId });

  // Build content from template
  const template = getTemplate(type, data);

  // Save to DB first
  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title:    template.title,
    body:     template.body,
    data,
    channels: channels || ['inapp'],
  });

  const results = { inapp: false, email: false, push: false };

  // ─── In-app via SSE ──────────────────────────────────────────
  if (!channels || channels.includes('inapp')) {
    if (!prefs || prefs.channels.inapp) {
      results.inapp = sendToUser(recipientId, notification);
      await notification.updateOne({
        'status.inapp': results.inapp ? 'sent' : 'failed',
      });
    }
  }

  // ─── Email ───────────────────────────────────────────────────
  if (channels?.includes('email') && template.email) {
    if (!prefs || prefs.channels.email) {
      const to = emailAddress || prefs?.email;
      results.email = await sendEmail({ to, ...template.email });
      await notification.updateOne({
        'status.email': results.email ? 'sent' : 'failed',
      });
    }
  }

  // ─── Push ────────────────────────────────────────────────────
  if (channels?.includes('push')) {
    if (prefs?.channels.push && prefs?.pushSubscription) {
      results.push = await sendPush(prefs.pushSubscription, {
        title: template.title,
        body:  template.body,
        data,
      });
      await notification.updateOne({
        'status.push': results.push ? 'sent' : 'failed',
      });
    }
  }

  logger.info(`Notification processed: ${JSON.stringify(results)}`);
  return results;
};

const startWorker = () => {
  const worker = new Worker('notifications', processNotification, {
    connection: getRedis(),
    concurrency: 5,
  });

  worker.on('completed', (job) => logger.info(`Job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Job ${job.id} failed: ${err.message}`));

  logger.info('Notification worker started');
  return worker;
};

module.exports = { startWorker };