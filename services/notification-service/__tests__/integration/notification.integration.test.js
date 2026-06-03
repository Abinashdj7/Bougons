/**
 * Integration tests for notification-service.
 * Uses mongodb-memory-server for a real in-memory DB.
 * BullMQ queue (enqueue) and worker are mocked — we test the HTTP layer and DB
 * persistence directly, not job processing.
 */

// ── Mock BullMQ queue — enqueue must not touch a real Redis ───────────────────
jest.mock('../../src/queues/notification.queue', () => ({
  enqueue: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  getQueue: jest.fn(),
}));

// ── Mock push + worker so app.js start() side-effects never run ───────────────
jest.mock('../../src/channels/push.channel', () => ({
  init: jest.fn(),
  sendPush: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/workers/notification.worker', () => ({
  startWorker: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const notificationRoutes = require('../../src/routes/notification.routes');
const errorMiddleware    = require('../../src/middlewares/error.middleware');
const Notification        = require('../../src/models/notification.model');
const Preference          = require('../../src/models/preference.model');
const { enqueue }         = require('../../src/queues/notification.queue');

const JWT_SECRET      = 'notification-integration-test-secret';
const INTERNAL_SECRET = 'internal-test-secret';

// ── Test identities ────────────────────────────────────────────────────────────
const userId   = new mongoose.Types.ObjectId().toString();
const otherId  = new mongoose.Types.ObjectId().toString();

const sign = (id, role = 'rider') => jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });
const userToken  = sign(userId);
const otherToken = sign(otherId);

// ── Test app ──────────────────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  // Mirrors app.js route mounting
  app.use('/api/notifications', notificationRoutes);
  app.use('/internal',          notificationRoutes);
  app.use(errorMiddleware);
  return app;
};

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  process.env.JWT_SECRET      = JWT_SECRET;
  process.env.INTERNAL_SECRET = INTERNAL_SECRET;
  process.env.NODE_ENV        = 'test';

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

// ── Seed helper ───────────────────────────────────────────────────────────────
const seedNotification = (overrides = {}) =>
  Notification.create({
    recipient: userId,
    type:  'ride_confirmed',
    title: 'Ride Confirmed',
    body:  'Your driver is on the way',
    ...overrides,
  });

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/notifications', () => {
  it('returns an empty list when the user has no notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(0);
    expect(res.body.data.unreadCount).toBe(0);
  });

  it('returns notifications belonging to the authenticated user', async () => {
    await seedNotification();
    await seedNotification({ type: 'driver_arriving', title: 'Driver Arriving', body: 'Almost there' });
    // Noise — belongs to a different user
    await Notification.create({
      recipient: otherId, type: 'ride_confirmed',
      title: 'Other', body: 'Other notification',
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(2);
  });

  it('reports the correct unread count', async () => {
    await seedNotification({ read: false });
    await seedNotification({ type: 'driver_arriving', title: 'T', body: 'B', read: true });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.body.data.unreadCount).toBe(1);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/notifications/:id/read', () => {
  it('marks a notification as read', async () => {
    const n = await seedNotification({ read: false });

    const res = await request(app)
      .put(`/api/notifications/${n._id}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await Notification.findById(n._id);
    expect(updated.read).toBe(true);
    expect(updated.readAt).toBeTruthy();
  });

  it('does not allow marking another user\'s notification as read', async () => {
    const n = await Notification.create({
      recipient: otherId, type: 'ride_confirmed',
      title: 'Other', body: 'Other notification',
    });

    await request(app)
      .put(`/api/notifications/${n._id}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    // The notification for otherId must remain unchanged
    const unchanged = await Notification.findById(n._id);
    expect(unchanged.read).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/notifications/read-all', () => {
  it('marks all unread notifications as read for the current user', async () => {
    await seedNotification({ read: false });
    await seedNotification({ type: 'driver_arriving', title: 'T2', body: 'B2', read: false });
    // Different user — must NOT be touched
    await Notification.create({
      recipient: otherId, type: 'ride_confirmed',
      title: 'Other', body: 'Other', read: false,
    });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    const unread = await Notification.countDocuments({ recipient: userId, read: false });
    expect(unread).toBe(0);

    // Other user's notification must be untouched
    const otherUnread = await Notification.countDocuments({ recipient: otherId, read: false });
    expect(otherUnread).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/notifications/:id', () => {
  it('deletes a notification owned by the user', async () => {
    const n = await seedNotification();

    const res = await request(app)
      .delete(`/api/notifications/${n._id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    const deleted = await Notification.findById(n._id);
    expect(deleted).toBeNull();
  });

  it('does not delete another user\'s notification', async () => {
    const n = await Notification.create({
      recipient: otherId, type: 'ride_confirmed',
      title: 'Other', body: 'Other',
    });

    await request(app)
      .delete(`/api/notifications/${n._id}`)
      .set('Authorization', `Bearer ${userToken}`);

    const still = await Notification.findById(n._id);
    expect(still).not.toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/notifications/preferences', () => {
  it('returns default preferences and creates them if none exist', async () => {
    const res = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.preferences).toBeDefined();
    expect(res.body.data.preferences.userId).toBe(userId);
  });

  it('returns existing preferences on subsequent calls', async () => {
    await Preference.create({ userId });

    const res = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    // Only one preference document for the user
    const count = await Preference.countDocuments({ userId });
    expect(count).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('PUT /api/notifications/preferences', () => {
  it('creates or updates notification preferences', async () => {
    const res = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ channels: { email: false, push: true } });

    expect(res.status).toBe(200);
    expect(res.body.data.preferences.channels).toMatchObject({ email: false, push: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('POST /internal/send', () => {
  it('enqueues a notification job and returns 202 with the job id', async () => {
    const res = await request(app)
      .post('/internal/send')
      .set('x-internal-secret', INTERNAL_SECRET)
      .send({ recipientId: userId, type: 'ride_confirmed', data: { rideId: 'ride-1' } });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBe('mock-job-id');
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: userId, type: 'ride_confirmed' })
    );
  });

  it('returns 400 when recipientId is missing', async () => {
    const res = await request(app)
      .post('/internal/send')
      .set('x-internal-secret', INTERNAL_SECRET)
      .send({ type: 'ride_confirmed' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post('/internal/send')
      .set('x-internal-secret', INTERNAL_SECRET)
      .send({ recipientId: userId });

    expect(res.status).toBe(400);
  });

  it('returns 401 when the internal secret is wrong', async () => {
    const res = await request(app)
      .post('/internal/send')
      .set('x-internal-secret', 'wrong-secret')
      .send({ recipientId: userId, type: 'ride_confirmed' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when the internal secret header is missing', async () => {
    const res = await request(app)
      .post('/internal/send')
      .send({ recipientId: userId, type: 'ride_confirmed' });

    expect(res.status).toBe(401);
  });
});
