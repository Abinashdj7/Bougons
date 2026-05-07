jest.mock('axios');
const axios = require('axios');
const rideService = require('../../src/services/ride.service');
const Ride = require('../../src/models/ride.model');

jest.mock('../../src/models/ride.model');
jest.mock('../../src/utils/fareCalculator', () => ({
    calculateFare: jest.fn(() => ({
        distance: 5.5,
        duration: 15,
        estimated: 12.5,
        surgeMultiplier: 1.0,
        breakdown: { baseFare: 2.5, distanceFare: 6.6, timeFare: 3.75 },
    })),
    getSurgeMultiplier: jest.fn(() => 1.0),
}));

describe('Ride Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('requestRide', () => {
        it('should create a new ride request', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'user123',
                status: 'searching',
                pickup: { address: 'A', location: { coordinates: [10, 20] } },
                destination: { address: 'B', location: { coordinates: [11, 21] } },
            };

            Ride.countDocuments.mockResolvedValue(5);
            Ride.create.mockResolvedValue(mockRide);

            const result = await rideService.requestRide({
                riderId: 'user123',
                pickup: { address: 'A', location: { coordinates: [10, 20] } },
                destination: { address: 'B', location: { coordinates: [11, 21] } },
                paymentMethod: 'card',
            });

            expect(result.ride).toEqual(mockRide);
            expect(result.fareData).toBeDefined();
            expect(Ride.create).toHaveBeenCalled();
        });
    });

    describe('acceptRide', () => {
        it('should accept a ride and update status', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'accepted',
                toString: () => 'ride123',
            };

            Ride.findOneAndUpdate.mockResolvedValue(mockRide);
            axios.post.mockResolvedValue({ data: {} });

            const result = await rideService.acceptRide('ride123', 'driver123');

            expect(result.status).toBe('accepted');
            expect(Ride.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: 'ride123', status: 'searching' },
                expect.objectContaining({ driver: 'driver123', status: 'accepted' }),
                { new: true }
            );
        });

        it('should throw error if ride not available', async () => {
            Ride.findOneAndUpdate.mockResolvedValue(null);

            await expect(rideService.acceptRide('ride123', 'driver123')).rejects.toThrow('Ride not available');
        });
    });

    describe('driverArriving', () => {
        it('should update status to driver_arriving', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'driver_arriving',
                toString: () => 'ride123',
            };

            Ride.findOneAndUpdate.mockResolvedValue(mockRide);
            axios.post.mockResolvedValue({ data: {} });

            const result = await rideService.driverArriving('ride123', 'driver123');

            expect(result.status).toBe('driver_arriving');
        });

        it('should throw error for invalid status transition', async () => {
            Ride.findOneAndUpdate.mockResolvedValue(null);

            await expect(rideService.driverArriving('ride123', 'driver123')).rejects.toThrow('Ride not found or invalid status');
        });
    });

    describe('startRide', () => {
        it('should start a ride', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'in_progress',
                startedAt: new Date(),
                toString: () => 'ride123',
            };

            Ride.findOneAndUpdate.mockResolvedValue(mockRide);
            axios.post.mockResolvedValue({ data: {} });

            const result = await rideService.startRide('ride123', 'driver123');

            expect(result.status).toBe('in_progress');
            expect(result.startedAt).toBeDefined();
        });
    });

    describe('completeRide', () => {
        it('should complete a ride', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'in_progress',
                fare: { estimated: 12.5, actual: null },
                payment: { status: 'pending' },
                save: jest.fn().mockResolvedValue(true),
                toString: () => 'ride123',
            };

            Ride.findOne.mockResolvedValue(mockRide);
            axios.post.mockResolvedValue({ data: {} });

            const result = await rideService.completeRide('ride123', 'driver123');

            expect(result.status).toBe('completed');
            expect(result.completedAt).toBeDefined();
            expect(result.fare.actual).toBe(12.5);
            expect(result.payment.status).toBe('paid');
            expect(mockRide.save).toHaveBeenCalled();
        });

        it('should throw error if ride not in progress', async () => {
            Ride.findOne.mockResolvedValue(null);

            await expect(rideService.completeRide('ride123', 'driver123')).rejects.toThrow('Ride not found or not in progress');
        });
    });

    describe('cancelRide', () => {
        it('should cancel a ride by rider', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'cancelled',
                cancelReason: 'Driver too far',
                toString: () => 'ride123',
            };

            Ride.findOneAndUpdate.mockResolvedValue(mockRide);
            axios.post.mockResolvedValue({ data: {} });

            const result = await rideService.cancelRide('ride123', 'rider123', 'rider', 'Driver too far');

            expect(result.status).toBe('cancelled');
            expect(result.cancelReason).toBe('Driver too far');
        });

        it('should throw error if ride cannot be cancelled', async () => {
            Ride.findOneAndUpdate.mockResolvedValue(null);

            await expect(rideService.cancelRide('ride123', 'rider123', 'rider', 'Too late')).rejects.toThrow('Ride not found or cannot be cancelled');
        });
    });

    describe('submitRating', () => {
        it('should submit rating from rider', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'completed',
                rating: { fromRider: null, fromDriver: null },
                save: jest.fn().mockResolvedValue(true),
                toString: () => 'rider123',
            };

            Ride.findOne.mockResolvedValue(mockRide);

            const result = await rideService.submitRating('ride123', 'rider123', 'rider', 5, 'Great ride!');

            expect(result.rating.fromRider).toBe(5);
            expect(result.rating.riderComment).toBe('Great ride!');
            expect(mockRide.save).toHaveBeenCalled();
        });

        it('should submit rating from driver', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'completed',
                rating: { fromRider: null, fromDriver: null },
                save: jest.fn().mockResolvedValue(true),
                toString: () => 'driver123',
            };

            Ride.findOne.mockResolvedValue(mockRide);

            const result = await rideService.submitRating('ride123', 'driver123', 'driver', 4, 'Good passenger');

            expect(result.rating.fromDriver).toBe(4);
            expect(result.rating.driverComment).toBe('Good passenger');
        });

        it('should throw error if not authorized to rate', async () => {
            const mockRide = {
                _id: 'ride123',
                rider: 'rider123',
                driver: 'driver123',
                status: 'completed',
                toString: () => 'rider123',
            };

            Ride.findOne.mockResolvedValue(mockRide);

            await expect(rideService.submitRating('ride123', 'other123', 'rider', 5, 'Great')).rejects.toThrow('Not authorized to rate this ride');
        });

        it('should throw error if ride not completed', async () => {
            Ride.findOne.mockResolvedValue(null);

            await expect(rideService.submitRating('ride123', 'rider123', 'rider', 5, 'Great')).rejects.toThrow('Ride not found or not completed');
        });
    });
});
