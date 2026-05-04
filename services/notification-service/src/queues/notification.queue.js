const { Queue } = require('bullmq');
const { getRedis } = require('../config/redis');
const { logger } = require('../utils/logger');

let notificationQueue;

const getQueue = () => {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    logger.info('Notification queue initialized');
  }
  return notificationQueue;
};

const enqueue = async (jobData) => {
  const queue = getQueue();
  const job = await queue.add('send-notification', jobData);
  logger.info(`Job enqueued: ${job.id}`);
  return job;
};

module.exports = { getQueue, enqueue };