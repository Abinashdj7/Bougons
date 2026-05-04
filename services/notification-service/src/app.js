const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { connectDB }    = require('./config/db');
const { connectRedis } = require('./config/redis');
const { logger }       = require('./utils/logger');
const { init: initPush } = require('./channels/push.channel');
const { startWorker }  = require('./workers/notification.worker');
const errorMiddleware  = require('./middlewares/error.middleware');
const notificationRoutes = require('./routes/notification.routes');

require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 4005;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

app.use('/api/notifications', notificationRoutes);
app.use('/internal',          notificationRoutes); // internal routes share same router

app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorMiddleware);

const start = async () => {
  try {
    await connectDB();
    await connectRedis();
    initPush();
    startWorker();
    app.listen(PORT, () => logger.info(`Notification service running on port ${PORT}`));
  } catch (err) {
    logger.error('Failed to start notification service', err);
    process.exit(1);
  }
};

start();