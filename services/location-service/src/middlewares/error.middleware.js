const { logger } = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  logger.error(err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorMiddleware;