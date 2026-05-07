const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const rideRoutes = require('../../src/routes/ride.routes');


jest.mock('../../src/models/ride.model');
jest.mock('../../src/services/ride.service');

const Ride = require('../../src/models/ride.model');
const rideService = require('../../src/services/ride.service');


const createTestApp = () => {
    const app = express();
    app.use(express.json());


    app.use((req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, 'test-secret');
                req.user = { id: decoded.id, role: decoded.role };
            } catch (err) {
                return res.status(401).json({ success: false, message: 'Invalid token' });
            }
        }
        next();
    });

    app.use('/api/rides', rideRoutes);
    return app;
};

const generateToken = (userId, role = 'rider') => {
    return jwt.sign({ id: userId, role }, 'test-secret');
};

describe('Ride Routes Integration Tests', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        app = createTestApp();
    });

    describe('GET /api/rides/estimate', () => {
        it('should return fare estimate with valid coordinates', async () => {
            const token = generateToken('user123', 'rider');
            Ride.countDocuments = jest.fn().mockResolvedValue(5);

            const response = await request(app)
                .get('/api/rides/estimate')
                .set('Authorization', `Bearer ${token}`)
                .query({
                    pickupLng: '10',
                    pickupLat: '20',
                    destLng: '11',
                    destLat: '21',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('estimated');
        });

        it('should return 400 without token', async () => {
            const response = await request(app)
                .get('/api/rides/estimate')
                .query({
                    pickupLng: '10',
                    pickupLat: '20',
                    destLng: '11',
                    destLat: '21',
                });

            expect(response.status).toBe(401);
        });

        it('should return 400 with missing coordinates', async () => {
            const token = generateToken('user123', 'rider');

            const response = await request(app)
                .get('/api/rides/estimate')
                .set('Authorization', `Bearer ${token}`)
                .query({ pickupLng: '10' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/rides', () => {
        it('should create ride request with valid data', async () => {
            const token = generateToken('user123', 'rider');
            const rideData = {
                pickup: {
                    address: 'Start',
                    location: { coordinates: [10, 20] },
                },
                destination: {
                    address: 'End',
                    location: { coordinates: [11, 21] },
                },
                paymentMethod: 'card',
            };

            const mockRide = {
                _id: 'ride123',
                status: 'searching',
                ...rideData,
            };

            rideService.requestRide.mockResolvedValue({
                ride: mockRide,
                fareData: { estimated: 12.5 },
            });

            const response = await request(app)
                .post('/api/rides')
                .set('Authorization', `Bearer ${token}`)
                .send(rideData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.ride).toBeDefined();
        });

        it('should reject request without rider role', async () => {
            const token = generateToken('user123', 'driver');
            const rideData = {
                pickup: {
                    address: 'Start',
                    location: { coordinates: [10, 20] },
                },
                destination: {
                    address: 'End',
                    location: { coordinates: [11, 21] },
                },
            };

            const response = await request(app)
                .post('/api/rides')
                .set('Authorization', `Bearer ${token}`)
                .send(rideData);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });

        it('should validate request body', async () => {
            const token = generateToken('user123', 'rider');
            const invalidData = {
                pickup: { address: 'Start' },
                destination: { address: 'End' },
            };

            const response = await request(app)
                .post('/api/rides')
                .set('Authorization', `Bearer ${token}`)
                .send(invalidData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/rides', () => {
        it('should return ride history', async () => {
            const token = generateToken('user123', 'rider');
            const mockRides = [
                { _id: 'ride1', status: 'completed' },
                { _id: 'ride2', status: 'completed' },
            ];

            Ride.find = jest.fn().mockReturnThis();
            Ride.sort = jest.fn().mockReturnThis();
            Ride.skip = jest.fn().mockReturnThis();
            Ride.limit = jest.fn().mockResolvedValue(mockRides);
            Ride.countDocuments = jest.fn().mockResolvedValue(2);

            const response = await request(app)
                .get('/api/rides')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.rides).toHaveLength(2);
        });
    });

    describe('GET /api/rides/:id', () => {
        it('should return ride details if user is owner', async () => {
            const token = generateToken('user123', 'rider');
            const mockRide = {
                _id: 'ride123',
                rider: 'user123',
                status: 'completed',
            };

            Ride.findById = jest.fn().mockResolvedValue(mockRide);

            const response = await request(app)
                .get('/api/rides/ride123')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.ride).toEqual(mockRide);
        });

        it('should return 403 if user is not owner', async () => {
            const token = generateToken('user123', 'rider');
            const mockRide = {
                _id: 'ride123',
                rider: 'other123',
                driver: null,
            };

            Ride.findById = jest.fn().mockResolvedValue(mockRide);

            const response = await request(app)
                .get('/api/rides/ride123')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
        });
    });

    describe('PUT /api/rides/:id/accept', () => {
        it('should accept ride as driver', async () => {
            const token = generateToken('driver123', 'driver');
            const mockRide = {
                _id: 'ride123',
                driver: 'driver123',
                status: 'accepted',
            };

            rideService.acceptRide.mockResolvedValue(mockRide);

            const response = await request(app)
                .put('/api/rides/ride123/accept')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject non-driver', async () => {
            const token = generateToken('rider123', 'rider');

            const response = await request(app)
                .put('/api/rides/ride123/accept')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
        });
    });

    describe('PUT /api/rides/:id/cancel', () => {
        it('should cancel ride with reason', async () => {
            const token = generateToken('user123', 'rider');
            const mockRide = {
                _id: 'ride123',
                status: 'cancelled',
                cancelReason: 'Driver too far',
            };

            rideService.cancelRide.mockResolvedValue(mockRide);

            const response = await request(app)
                .put('/api/rides/ride123/cancel')
                .set('Authorization', `Bearer ${token}`)
                .send({ reason: 'Driver too far' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/rides/:id/rate', () => {
        it('should submit rating with valid score', async () => {
            const token = generateToken('user123', 'rider');
            const mockRide = {
                _id: 'ride123',
                rating: { fromRider: 5, riderComment: 'Great!' },
            };

            rideService.submitRating.mockResolvedValue(mockRide);

            const response = await request(app)
                .post('/api/rides/ride123/rate')
                .set('Authorization', `Bearer ${token}`)
                .send({ score: 5, comment: 'Great!' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject invalid score', async () => {
            const token = generateToken('user123', 'rider');

            const response = await request(app)
                .post('/api/rides/ride123/rate')
                .set('Authorization', `Bearer ${token}`)
                .send({ score: 10, comment: 'Great!' });

            expect(response.status).toBe(400);
        });
    });
});
