const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const { logger } = require('./utils/logger');
const errorMiddleware = require('./middlewares/error.middleware');
const locationRoutes = require('./routes/location.routes');
const locationService = require('./services/location.service');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
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


const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
    ],
    credentials: true,
  },
});


io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { id, role } = socket.user;
  logger.info(`Socket connected: ${role} ${id}`);


  if (role === 'driver') {
    socket.join(`driver:${id}`);
  }


  if (role === 'rider') {
    socket.join(`rider:${id}`);
  }


  socket.on('driver:location_update', async ({ coordinates, heading, speed }) => {
    if (role !== 'driver') return;

    await locationService.updateDriverLocation(id, { coordinates, heading, speed });


    socket.to(`tracking:${id}`).emit('driver:location', { driverId: id, coordinates, heading });
  });


  socket.on('rider:track_driver', ({ driverId }) => {
    if (role !== 'rider') return;
    socket.join(`tracking:${driverId}`);
    logger.info(`Rider ${id} tracking driver ${driverId}`);
  });


  socket.on('driver:online', async () => {
    if (role !== 'driver') return;
    await locationService.setDriverOnlineStatus(id, true);
    socket.emit('driver:status', { isOnline: true });
  });


  socket.on('driver:offline', async () => {
    if (role !== 'driver') return;
    await locationService.setDriverOnlineStatus(id, false);
    socket.emit('driver:status', { isOnline: false });
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${role} ${id}`);

  });
});


app.set('io', io);


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'location-service' });
});

app.use('/api/location', locationRoutes);
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorMiddleware);


const start = async () => {
  try {
    await connectDB();
    await connectRedis();
    server.listen(PORT, () => logger.info(`Location service running on port ${PORT}`));
  } catch (error) {
    logger.error('Failed to start location service', error);
    process.exit(1);
  }
};

start();
