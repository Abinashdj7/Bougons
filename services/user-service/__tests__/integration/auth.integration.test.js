/**
 * Integration tests for user-service auth routes.
 * Uses mongodb-memory-server for a real in-memory database and an in-memory
 * Redis mock, so no external services are required.
 */

// ── Redis mock (must come before any module that imports config/redis) ────────
jest.mock('../../src/config/redis', () => {
  const store = new Map();
  const client = {
    setEx: jest.fn((k, _ttl, v) => { store.set(k, v); return Promise.resolve('OK'); }),
    get:   jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    del:   jest.fn((k) => { store.delete(k); return Promise.resolve(1); }),
    exists: jest.fn((k) => Promise.resolve(store.has(k) ? 1 : 0)),
    store, // exposed so tests can clear it between runs
  };
  return { connectRedis: jest.fn().mockResolvedValue(), getRedis: () => client };
});

// Silence logger output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Bypass rate-limiting so repeated test calls are never throttled
jest.mock('../../src/middlewares/rateLimiter.middleware', () => ({
  authLimiter:    (req, res, next) => next(),
  generalLimiter: (req, res, next) => next(),
}));

const mongoose   = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request    = require('supertest');
const express    = require('express');
const cookieParser = require('cookie-parser');

const authRoutes      = require('../../src/routes/auth.routes');
const errorMiddleware = require('../../src/middlewares/error.middleware');
const { getRedis }    = require('../../src/config/redis');

// ── Test app (mirrors app.js without the start() / DB / Redis calls) ──────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use(errorMiddleware);
  return app;
};

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  process.env.JWT_SECRET         = 'integration-test-secret';
  process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret';
  process.env.JWT_EXPIRES_IN     = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.NODE_ENV           = 'test';

  app = buildApp();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  // Clear every collection
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
  // Clear the in-memory Redis store
  getRedis().store.clear();
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const registerRider = (overrides = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({ name: 'Alice', email: 'alice@test.com', password: 'password123', role: 'rider', ...overrides });

const loginAs = (email, password) =>
  request(app).post('/api/auth/login').send({ email, password });

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/register', () => {
  it('registers a new rider and returns 201 with access token', async () => {
    const res = await registerRider();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Registration successful');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user.role).toBe('rider');
    // Password must never be exposed
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('registers a driver and creates a Driver profile record', async () => {
    const res = await registerRider({ name: 'Bob', email: 'bob@test.com', role: 'driver' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('driver');

    const Driver = require('../../src/models/driver.model');
    const driverDoc = await Driver.findOne({ userId: res.body.data.user._id });
    expect(driverDoc).not.toBeNull();
  });

  it('sets a refreshToken httpOnly cookie on successful registration', async () => {
    const res = await registerRider();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });

  it('returns 409 when the email is already registered', async () => {
    await registerRider();
    const res = await registerRider(); // same email

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email already registered');
  });

  it('returns 400 for missing required fields (Joi validation)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'noname@test.com', password: 'password123' }); // name missing

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    const res = await registerRider({ password: 'short' });

    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerRider();
    getRedis().store.clear(); // discard registration's refresh token so login is clean
  });

  it('returns 200 with access token for valid credentials', async () => {
    const res = await loginAs('alice@test.com', 'password123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('sets a refreshToken cookie on successful login', async () => {
    const res = await loginAs('alice@test.com', 'password123');

    const cookies = res.headers['set-cookie'] ?? [];
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('returns 401 for an incorrect password', async () => {
    const res = await loginAs('alice@test.com', 'wrongpassword');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('returns 401 for an email that does not exist', async () => {
    const res = await loginAs('ghost@test.com', 'password123');

    expect(res.status).toBe(401);
  });

  it('returns 403 for a deactivated account', async () => {
    const User = require('../../src/models/user.model');
    await User.findOneAndUpdate({ email: 'alice@test.com' }, { isActive: false });

    const res = await loginAs('alice@test.com', 'password123');

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const { body: { data: { accessToken } } } = await registerRider();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-jwt');

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/refresh', () => {
  it('returns a new access token when a valid refresh cookie is provided', async () => {
    const loginRes = await registerRider()
      .then(() => loginAs('alice@test.com', 'password123'));

    // Extract the refresh token cookie from the login response
    const rawCookie = (loginRes.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('refreshToken='));
    expect(rawCookie).toBeDefined();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', rawCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the refresh token has been tampered with', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=tampered.token.value');

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/logout', () => {
  it('returns 200 and subsequent requests with the same token are rejected', async () => {
    const { body: { data: { accessToken } } } = await registerRider();

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // The access token must now be blacklisted
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(401);
  });

  it('clears the refreshToken cookie on logout', async () => {
    const { body: { data: { accessToken } } } = await registerRider();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    const cookies = res.headers['set-cookie'] ?? [];
    // Cookie should be cleared (expires in the past or maxAge=0)
    expect(cookies.some((c) => c.includes('refreshToken=;') || c.includes('Expires=Thu, 01 Jan 1970'))).toBe(true);
  });

  it('returns 401 when called without a token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});
