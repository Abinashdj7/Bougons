const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { logger } = require('./utils/logger');
const errorMiddleware = require('./middlewares/error.middleware');
const locationRoutes = require('./routes/location.routes');
const internalRoutes = require('./routes/internal.routes');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4003;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'location-service' });
});

app.use('/api/location', locationRoutes);
app.use('/internal',    internalRoutes);
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorMiddleware);

const start = async () => {
  try {
    await connectDB();
    await connectRedis();
    app.listen(PORT, () => logger.info(`Location service running on port ${PORT}`));
  } catch (error) {
    logger.error('Failed to start location service', error);
    process.exit(1);
  }
};

start();
