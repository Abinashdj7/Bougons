const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const winston = require('winston');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Logger ───────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
});

// ─── CORS ─────────────────────────────────────────────────────
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Middlewares ──────────────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests' },
}));

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    services: {
      userService:         process.env.USER_SERVICE_URL,
      rideService:         process.env.RIDE_SERVICE_URL         || 'not configured',
      locationService:     process.env.LOCATION_SERVICE_URL     || 'not configured',
      paymentService:      process.env.PAYMENT_SERVICE_URL      || 'not configured',
      notificationService: process.env.NOTIFICATION_SERVICE_URL || 'not configured',
    },
  });
});

// ─── Generic forward function ─────────────────────────────────
const forward = (serviceUrl) => async (req, res) => {
  try {
    const url = `${serviceUrl}${req.originalUrl}`;
    logger.info(`→ ${req.method} ${url}`);

    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { Authorization: req.headers.authorization }),
        ...(req.headers.cookie && { Cookie: req.headers.cookie }),
        'X-Forwarded-For': req.ip,
        'X-Gateway-Request': 'true',
      },
      validateStatus: () => true, // forward status as-is, don't throw
    });

    // Forward cookies set by the service back to the browser
    if (response.headers['set-cookie']) {
      res.setHeader('Set-Cookie', response.headers['set-cookie']);
    }

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error(`Gateway forward error: ${error.message}`);
    res.status(502).json({ success: false, message: 'Service unavailable' });
  }
};

// ─── Routes → Services ───────────────────────────────────────
const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:4001';

app.all('/api/auth/*',    forward(USER_SERVICE));
app.all('/api/profile/*', forward(USER_SERVICE));

// Phase 2+ — uncomment as services are added
// const RIDE_SERVICE         = process.env.RIDE_SERVICE_URL         || 'http://ride-service:4002';
// const LOCATION_SERVICE     = process.env.LOCATION_SERVICE_URL     || 'http://location-service:4003';
// const PAYMENT_SERVICE      = process.env.PAYMENT_SERVICE_URL      || 'http://payment-service:4004';
// const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';
// app.all('/api/rides/*',         forward(RIDE_SERVICE));
// app.all('/api/location/*',      forward(LOCATION_SERVICE));
// app.all('/api/payments/*',      forward(PAYMENT_SERVICE));
// app.all('/api/notifications/*', forward(NOTIFICATION_SERVICE));

// ─── 404 ──────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});