const { logger } = require('../utils/logger');

// SSE clients map: userId → res object
const sseClients = new Map();

const addClient = (userId, res) => {
  sseClients.set(userId, res);
  logger.info(`SSE client connected: ${userId}`);
};

const removeClient = (userId) => {
  sseClients.delete(userId);
  logger.info(`SSE client disconnected: ${userId}`);
};

const sendToUser = (userId, notification) => {
  const client = sseClients.get(userId.toString());
  if (client) {
    try {
      client.write(`data: ${JSON.stringify(notification)}\n\n`);
      return true;
    } catch (err) {
      logger.error(`SSE send error: ${err.message}`);
      removeClient(userId.toString());
      return false;
    }
  }
  return false;
};

module.exports = { addClient, removeClient, sendToUser };