jest.mock('../../src/services/ride.service');
jest.mock('../../src/models/ride.model');
const rideService = require('../../src/services/ride.service');
const Ride = require('../../src/models/ride.model');
const {
    requestRide,
    getEstimate,
    getRideHistory,
    getRide,
    acceptRide,
    driverArriving,
    startRide,
    completeRide,
    cancelRide,
    submitRating,
} = require('../../src/controllers/ride.controller');

describe('Ride Controller', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            body: {},
            query: {},
            params: {},
            user: { id: 'user123', role: 'rider' },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    describe('requestRide', () => {
        it('should request a ride successfully', async () => {
            req.body = {
                pickup: {
                    address: 'Start Point',
                    location: { coordinates: [10, 20] },
                },
                destination: {
                    address: 'End Point',
                    location: { coordinates: [11, 21] },
                },
                paymentMethod: 'card',
            };

            const mockRideData = {
                ride: { _id: 'ride123', status: 'searching' },
                fareData: { estimated: 12.5 },
            };

            rideService.requestRide.mockResolvedValue(mockRideData);

            await requestRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: mockRideData,
            });
        });

        it('should return 400 if coordinates missing', async () => {
            req.body = {
                pickup: { address: 'Start' },
                destination: { address: 'End' },
            };

            await requestRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining('coordinates'),
            });
        });

        it('should call next on error', async () => {
            req.body = {
                pickup: { address: 'Start', location: { coordinates: [10, 20] } },
                destination: { address: 'End', location: { coordinates: [11, 21] } },
            };

            const error = new Error('Service error');
            rideService.requestRide.mockRejectedValue(error);

            await requestRide(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('getEstimate', () => {
        it('should return fare estimate', async () => {
            req.query = {
                pickupLng: '10',
                pickupLat: '20',
                destLng: '11',
                destLat: '21',
            };

            Ride.countDocuments = jest.fn().mockResolvedValue(5);

            await getEstimate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    distance: expect.any(Number),
                    estimated: expect.any(Number),
                }),
            });
        });

        it('should return 400 if coordinates missing', async () => {
            req.query = { pickupLng: '10' };

            await getEstimate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getRideHistory', () => {
        it('should return ride history for rider', async () => {
            req.query = { page: '1', limit: '10' };
            req.user.role = 'rider';

            const mockRides = [
                { _id: 'ride1', status: 'completed' },
                { _id: 'ride2', status: 'completed' },
            ];

            Ride.find = jest.fn().mockReturnThis();
            Ride.sort = jest.fn().mockReturnThis();
            Ride.skip = jest.fn().mockReturnThis();
            Ride.limit = jest.fn().mockResolvedValue(mockRides);
            Ride.countDocuments = jest.fn().mockResolvedValue(2);

            await getRideHistory(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    rides: mockRides,
                    total: 2,
                    page: 1,
                    pages: 1,
                }),
            });
        });

        it('should return ride history for driver', async () => {
            req.user.role = 'driver';
            req.query = { page: '1', limit: '10' };

            Ride.find = jest.fn().mockReturnThis();
            Ride.sort = jest.fn().mockReturnThis();
            Ride.skip = jest.fn().mockReturnThis();
            Ride.limit = jest.fn().mockResolvedValue([]);
            Ride.countDocuments = jest.fn().mockResolvedValue(0);

            await getRideHistory(req, res, next);

            expect(Ride.find).toHaveBeenCalledWith({ driver: 'user123' });
        });
    });

    describe('getRide', () => {
        it('should return ride if user is owner', async () => {
            req.params.id = 'ride123';
            const mockRide = { _id: 'ride123', rider: 'user123', driver: null };

            Ride.findById = jest.fn().mockResolvedValue(mockRide);

            await getRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { ride: mockRide },
            });
        });

        it('should return 404 if ride not found', async () => {
            req.params.id = 'ride123';
            Ride.findById = jest.fn().mockResolvedValue(null);

            await getRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return 403 if user is not owner', async () => {
            req.params.id = 'ride123';
            const mockRide = { _id: 'ride123', rider: 'other123', driver: null };

            Ride.findById = jest.fn().mockResolvedValue(mockRide);

            await getRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('acceptRide', () => {
        it('should accept ride successfully', async () => {
            req.params.id = 'ride123';
            req.user.role = 'driver';
            const mockRide = { _id: 'ride123', driver: 'user123', status: 'accepted' };

            rideService.acceptRide.mockResolvedValue(mockRide);

            await acceptRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { ride: mockRide },
            });
        });
    });

    describe('submitRating', () => {
        it('should submit rating successfully', async () => {
            req.params.id = 'ride123';
            req.body = { score: 5, comment: 'Great driver!' };

            const mockRide = {
                _id: 'ride123',
                rating: { fromRider: 5, riderComment: 'Great driver!' },
            };

            rideService.submitRating.mockResolvedValue(mockRide);

            await submitRating(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { ride: mockRide },
            });
        });

        it('should return 400 if score invalid', async () => {
            req.params.id = 'ride123';
            req.body = { score: 10, comment: 'Great!' };

            await submitRating(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if score missing', async () => {
            req.params.id = 'ride123';
            req.body = { comment: 'Great!' };

            await submitRating(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('driverArriving', () => {
        it('should update status to driver_arriving', async () => {
            req.params.id = 'ride123';
            const mockRide = { _id: 'ride123', status: 'driver_arriving' };

            rideService.driverArriving.mockResolvedValue(mockRide);

            await driverArriving(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { ride: mockRide },
            });
        });
    });

    describe('startRide', () => {
        it('should start ride successfully', async () => {
            req.params.id = 'ride123';
            const mockRide = { _id: 'ride123', status: 'in_progress', startedAt: new Date() };

            rideService.startRide.mockResolvedValue(mockRide);

            await startRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('completeRide', () => {
        it('should complete ride successfully', async () => {
            req.params.id = 'ride123';
            const mockRide = { _id: 'ride123', status: 'completed', completedAt: new Date() };

            rideService.completeRide.mockResolvedValue(mockRide);

            await completeRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('cancelRide', () => {
        it('should cancel ride successfully', async () => {
            req.params.id = 'ride123';
            req.body = { reason: 'Driver not responding' };
            const mockRide = { _id: 'ride123', status: 'cancelled' };

            rideService.cancelRide.mockResolvedValue(mockRide);

            await cancelRide(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(rideService.cancelRide).toHaveBeenCalledWith('ride123', 'user123', 'rider', 'Driver not responding');
        });
    });
});
