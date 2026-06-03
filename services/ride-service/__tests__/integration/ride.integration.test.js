/**
 * Integration tests for ride-service.
 * Uses mongodb-memory-server; external HTTP calls (notification-service,
 * location-service) are mocked via jest.mock('axios').
 */

// Mock axios before any module that imports it
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: { success: true } }),
  get:  jest.fn().mockResolvedValue({ data: { data: { drivers: [] } } }),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const rideRoutes      = require('../../src/routes/ride.routes');
const errorMiddleware = require('../../src/middlewares/error.middleware');
const Ride            = require('../../src/models/ride.model');

const JWT_SECRET = 'ride-integration-test-secret';

// ── Helpers ───────────────────────────────────────────────────────────────────
const sign = (id, role) => jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });

const riderId  = new mongoose.Types.ObjectId().toString();
const driverId = new mongoose.Types.ObjectId().toString();
const adminId  = new mongoose.Types.ObjectId().toString();

const riderToken  = sign(riderId,  'rider');
const driverToken = sign(driverId, 'driver');

const pickupCoords = [2.3522, 48.8566];   // [lng, lat]  Paris
const destCoords   = [2.2945, 48.8738];   // Eiffel Tower area

const validRideBody = {
  pickup: {
    address: 'Paris, France',
    location: { type: 'Point', coordinates: pickupCoords },
  },
  destination: {
    address: 'Eiffel Tower',
    location: { type: 'Point', coordinates: destCoords },
  },
  paymentMethod: 'card',
};

// ── Test app ──────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/rides', rideRoutes);
  app.use(errorMiddleware);
  return app;
};

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  process.env.JWT_SECRET = JWT_SECRET;
  process.env.NODE_ENV   = 'test';

  app = buildApp();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/rides/estimate', () => {
  it('returns a fare estimate for valid coordinates', async () => {
    const res = await request(app)
      .get('/api/rides/estimate')
      .set('Authorization', `Bearer ${riderToken}`)
      .query({ pickupLng: '2.3522', pickupLat: '48.8566', destLng: '2.2945', destLat: '48.8738' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      estimated:       expect.any(Number),
      distance:        expect.any(Number),
      duration:        expect.any(Number),
      surgeMultiplier: expect.any(Number),
    });
  });

  it('returns 400 when coordinates are missing', async () => {
    const res = await request(app)
      .get('/api/rides/estimate')
      .set('Authorization', `Bearer ${riderToken}`)
      .query({ pickupLng: '2.35' }); // incomplete

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for non-numeric coordinate values', async () => {
    const res = await request(app)
      .get('/api/rides/estimate')
      .set('Authorization', `Bearer ${riderToken}`)
      .query({ pickupLng: 'abc', pickupLat: 'xyz', destLng: '2.29', destLat: '48.87' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .get('/api/rides/estimate')
      .query({ pickupLng: '2.35', pickupLat: '48.85', destLng: '2.29', destLat: '48.87' });

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/rides', () => {
  it('creates a ride and persists it to the database', async () => {
    const res = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${riderToken}`)
      .send(validRideBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ride._id).toBeDefined();
    expect(res.body.data.ride.status).toBe('searching');

    // Verify persistence
    const inDb = await Ride.findById(res.body.data.ride._id);
    expect(inDb).not.toBeNull();
    expect(inDb.rider.toString()).toBe(riderId);
  });

  it('returns 403 when a driver tries to create a ride', async () => {
    const res = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(validRideBody);

    expect(res.status).toBe(403);
  });

  it('returns 400 when pickup coordinates are missing', async () => {
    const res = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ pickup: { address: 'Paris' }, destination: { address: 'Eiffel Tower' } });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/rides').send(validRideBody);
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/rides', () => {
  it('returns the ride history for the authenticated user', async () => {
    // Seed two rides for the rider
    await Ride.create([
      { rider: riderId, status: 'completed', pickup: { address: 'A', location: { coordinates: [1, 1] } }, destination: { address: 'B', location: { coordinates: [2, 2] } }, fare: { estimated: 10 } },
      { rider: riderId, status: 'cancelled', pickup: { address: 'C', location: { coordinates: [3, 3] } }, destination: { address: 'D', location: { coordinates: [4, 4] } }, fare: { estimated: 8 } },
    ]);

    const res = await request(app)
      .get('/api/rides')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rides).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });

  it('returns only the driver\'s rides when called as a driver', async () => {
    await Ride.create({
      rider: riderId, driver: driverId, status: 'completed',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });

    const res = await request(app)
      .get('/api/rides')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rides).toHaveLength(1);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/rides');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/rides/:id', () => {
  let rideId;

  beforeEach(async () => {
    const ride = await Ride.create({
      rider: riderId, status: 'completed',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });
    rideId = ride._id.toString();
  });

  it('returns ride details when the user is the rider', async () => {
    const res = await request(app)
      .get(`/api/rides/${rideId}`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ride._id).toBe(rideId);
  });

  it('returns 403 when the user is not associated with the ride', async () => {
    const otherId     = new mongoose.Types.ObjectId().toString();
    const otherToken  = sign(otherId, 'rider');

    const res = await request(app)
      .get(`/api/rides/${rideId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent ride', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/rides/${fakeId}`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Full ride lifecycle', () => {
  it('transitions correctly: searching → accepted → driver_arriving → in_progress → completed', async () => {
    // 1. Rider creates a ride
    const createRes = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${riderToken}`)
      .send(validRideBody);

    expect(createRes.status).toBe(201);
    const rideId = createRes.body.data.ride._id;

    // 2. Driver accepts the ride
    const acceptRes = await request(app)
      .put(`/api/rides/${rideId}/accept`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.ride.status).toBe('accepted');

    // 3. Driver is arriving
    const arrivingRes = await request(app)
      .put(`/api/rides/${rideId}/arriving`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(arrivingRes.status).toBe(200);
    expect(arrivingRes.body.data.ride.status).toBe('driver_arriving');

    // 4. Ride starts
    const startRes = await request(app)
      .put(`/api/rides/${rideId}/start`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(startRes.status).toBe(200);
    expect(startRes.body.data.ride.status).toBe('in_progress');

    // 5. Ride completed
    const completeRes = await request(app)
      .put(`/api/rides/${rideId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.ride.status).toBe('completed');
    expect(completeRes.body.data.ride.payment.status).toBe('paid');

    // Verify final state in DB
    const finalRide = await Ride.findById(rideId);
    expect(finalRide.status).toBe('completed');
    expect(finalRide.completedAt).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/rides/:id/accept', () => {
  it('returns 403 when a rider tries to accept a ride', async () => {
    const ride = await Ride.create({
      rider: riderId, status: 'searching',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });

    const res = await request(app)
      .put(`/api/rides/${ride._id}/accept`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 409 when a ride is already accepted', async () => {
    const ride = await Ride.create({
      rider: riderId, driver: driverId, status: 'accepted',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });

    const res = await request(app)
      .put(`/api/rides/${ride._id}/accept`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/rides/:id/cancel', () => {
  it('allows a rider to cancel a searching ride', async () => {
    const ride = await Ride.create({
      rider: riderId, status: 'searching',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });

    const res = await request(app)
      .put(`/api/rides/${ride._id}/cancel`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.data.ride.status).toBe('cancelled');
    expect(res.body.data.ride.cancelReason).toBe('Changed my mind');
  });

  it('returns 409 when attempting to cancel a completed ride', async () => {
    const ride = await Ride.create({
      rider: riderId, status: 'completed',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });

    const res = await request(app)
      .put(`/api/rides/${ride._id}/cancel`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ reason: 'Too late' });

    expect(res.status).toBe(409);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/rides/:id/rate', () => {
  let completedRideId;

  beforeEach(async () => {
    const ride = await Ride.create({
      rider: riderId, driver: driverId, status: 'completed',
      pickup: { address: 'A', location: { coordinates: [1, 1] } },
      destination: { address: 'B', location: { coordinates: [2, 2] } },
      fare: { estimated: 10 },
    });
    completedRideId = ride._id.toString();
  });

  it('allows the rider to rate a completed ride', async () => {
    const res = await request(app)
      .post(`/api/rides/${completedRideId}/rate`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ score: 5, comment: 'Excellent ride!' });

    expect(res.status).toBe(200);
    expect(res.body.data.ride.rating.fromRider).toBe(5);
    expect(res.body.data.ride.rating.riderComment).toBe('Excellent ride!');
  });

  it('allows the driver to rate a completed ride', async () => {
    const res = await request(app)
      .post(`/api/rides/${completedRideId}/rate`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ score: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.ride.rating.fromDriver).toBe(4);
  });

  it('returns 400 for a score outside the 1-5 range', async () => {
    const res = await request(app)
      .post(`/api/rides/${completedRideId}/rate`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ score: 6 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when score is missing', async () => {
    const res = await request(app)
      .post(`/api/rides/${completedRideId}/rate`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ comment: 'No score here' });

    expect(res.status).toBe(400);
  });
});
