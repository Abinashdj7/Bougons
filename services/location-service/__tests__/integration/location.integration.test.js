/**
 * Integration tests for location-service.
 * Uses mongodb-memory-server for real DB; Redis is mocked in-memory so the
 * caching layer in location.service.js works without a live Redis instance.
 */

// ── Redis mock ────────────────────────────────────────────────────────────────
jest.mock('../../src/config/redis', () => {
  const store = new Map();
  const client = {
    setEx:  jest.fn((k, _ttl, v) => { store.set(k, v); return Promise.resolve('OK'); }),
    get:    jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    del:    jest.fn((k) => { store.delete(k); return Promise.resolve(1); }),
    exists: jest.fn((k) => Promise.resolve(store.has(k) ? 1 : 0)),
    store,
  };
  return { connectRedis: jest.fn().mockResolvedValue(), getRedis: () => client };
});

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const locationRoutes  = require('../../src/routes/location.routes');
const errorMiddleware = require('../../src/middlewares/error.middleware');
const DriverLocation  = require('../../src/models/location.model');
const { getRedis }    = require('../../src/config/redis');

const JWT_SECRET = 'location-integration-test-secret';

// ── Identities ────────────────────────────────────────────────────────────────
const driverId = new mongoose.Types.ObjectId().toString();
const riderId  = new mongoose.Types.ObjectId().toString();
const adminId  = new mongoose.Types.ObjectId().toString();

const sign = (id, role) => jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });

const driverToken = sign(driverId, 'driver');
const riderToken  = sign(riderId,  'rider');
const adminToken  = sign(adminId,  'admin');

// ── Test app ──────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/location', locationRoutes);
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
  getRedis().store.clear();
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/location/drivers/update', () => {
  const coords = [2.3522, 48.8566];

  it('creates or updates driver location in the database', async () => {
    const res = await request(app)
      .put('/api/location/drivers/update')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ coordinates: coords, heading: 90, speed: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await DriverLocation.findOne({ driverId });
    expect(doc).not.toBeNull();
    expect(doc.location.coordinates).toEqual(coords);
    expect(doc.isOnline).toBe(true);
  });

  it('caches the location in Redis', async () => {
    await request(app)
      .put('/api/location/drivers/update')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ coordinates: coords });

    expect(getRedis().setEx).toHaveBeenCalledWith(
      `driver:location:${driverId}`,
      expect.any(Number),
      expect.stringContaining('"coordinates"')
    );
  });

  it('returns 403 when a rider calls this endpoint', async () => {
    const res = await request(app)
      .put('/api/location/drivers/update')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ coordinates: coords });

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/api/location/drivers/update')
      .send({ coordinates: coords });

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/location/drivers/status', () => {
  it('sets driver online', async () => {
    // A driver must have a location record before toggling status
    // (coordinates are required by the model, upsert alone is not enough)
    await DriverLocation.create({
      driverId,
      isOnline: false,
      location: { type: 'Point', coordinates: [2.3522, 48.8566] },
    });

    const res = await request(app)
      .put('/api/location/drivers/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ isOnline: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await DriverLocation.findOne({ driverId });
    expect(doc.isOnline).toBe(true);
  });

  it('sets driver offline and removes Redis cache entry', async () => {
    // Put driver online first
    await request(app)
      .put('/api/location/drivers/update')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ coordinates: [2.35, 48.85] });

    // Go offline
    const res = await request(app)
      .put('/api/location/drivers/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ isOnline: false });

    expect(res.status).toBe(200);

    const doc = await DriverLocation.findOne({ driverId });
    expect(doc.isOnline).toBe(false);
    // Redis cache should be purged
    expect(getRedis().del).toHaveBeenCalledWith(`driver:location:${driverId}`);
  });

  it('returns 403 for a rider', async () => {
    const res = await request(app)
      .put('/api/location/drivers/status')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ isOnline: true });

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/location/drivers/nearby', () => {
  beforeEach(async () => {
    // Seed an online driver near Paris
    await DriverLocation.create({
      driverId,
      isOnline: true,
      location: { type: 'Point', coordinates: [2.3522, 48.8566] },
    });
  });

  it('returns nearby online drivers', async () => {
    const res = await request(app)
      .get('/api/location/drivers/nearby')
      .set('Authorization', `Bearer ${riderToken}`)
      .query({ lng: '2.3522', lat: '48.8566', maxDistance: '1000' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.drivers)).toBe(true);
    expect(res.body.data.drivers.length).toBeGreaterThanOrEqual(1);
  });

  it('returns an empty list when no drivers are in range', async () => {
    const res = await request(app)
      .get('/api/location/drivers/nearby')
      .set('Authorization', `Bearer ${riderToken}`)
      .query({ lng: '139.6917', lat: '35.6895', maxDistance: '100' }); // Tokyo — far from Paris

    expect(res.status).toBe(200);
    expect(res.body.data.drivers).toHaveLength(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .get('/api/location/drivers/nearby')
      .query({ lng: '2.35', lat: '48.85' });

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/location/drivers/:id', () => {
  beforeEach(async () => {
    await DriverLocation.create({
      driverId,
      isOnline: true,
      location: { type: 'Point', coordinates: [2.3522, 48.8566] },
      heading: 45,
      speed: 20,
    });
  });

  it('returns location from database when Redis cache is empty', async () => {
    const res = await request(app)
      .get(`/api/location/drivers/${driverId}`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location).toBeDefined();
  });

  it('returns cached location when Redis has an entry', async () => {
    const cachedData = JSON.stringify({ coordinates: [2.3522, 48.8566], heading: 90 });
    getRedis().store.set(`driver:location:${driverId}`, cachedData);

    const res = await request(app)
      .get(`/api/location/drivers/${driverId}`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(200);
    // Redis get should have been called for this key
    expect(getRedis().get).toHaveBeenCalledWith(`driver:location:${driverId}`);
  });

  it('returns 404 for an unknown driver', async () => {
    const unknownId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/location/drivers/${unknownId}`)
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/location/drivers (admin only)', () => {
  beforeEach(async () => {
    await DriverLocation.create([
      { driverId: new mongoose.Types.ObjectId(), isOnline: true,  location: { type: 'Point', coordinates: [2.35, 48.85] } },
      { driverId: new mongoose.Types.ObjectId(), isOnline: false, location: { type: 'Point', coordinates: [2.36, 48.86] } },
    ]);
  });

  it('returns all online drivers when called as admin', async () => {
    const res = await request(app)
      .get('/api/location/drivers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.drivers).toHaveLength(1); // only the online one
  });

  it('returns 403 for a rider', async () => {
    const res = await request(app)
      .get('/api/location/drivers')
      .set('Authorization', `Bearer ${riderToken}`);

    expect(res.status).toBe(403);
  });
});
