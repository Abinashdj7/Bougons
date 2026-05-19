const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { connectDB }    = require('./config/db');
const { logger }       = require('./utils/logger');
const errorMiddleware  = require('./middlewares/error.middleware');
const paymentRoutes    = require('./routes/payment.routes');

require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 4004;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));


app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'payment-service' });
});

app.use('/api/payments', paymentRoutes);
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorMiddleware);

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => logger.info(`Payment service running on port ${PORT}`));
  } catch (err) {
    logger.error('Failed to start payment service', err);
    process.exit(1);
  }
};

start();
