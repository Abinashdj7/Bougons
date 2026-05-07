jest.mock('../models/location.model');
jest.mock('../config/redis');
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const DriverLocation = require('../models/location.model');
const { getRedis } = require('../config/redis');
const locationService = require('./location.service');

describe('Location Service', () => {
    let redisMock;

    beforeEach(() => {
        redisMock = {
            setEx: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1),
        };
        getRedis.mockReturnValue(redisMock);
        jest.clearAllMocks();
        getRedis.mockReturnValue(redisMock);
    });

    describe('updateDriverLocation', () => {
        it('should save location to redis and upsert in mongo', async () => {
            DriverLocation.findOneAndUpdate.mockResolvedValue({});

            const result = await locationService.updateDriverLocation('driver123', {
                coordinates: [13.4, 52.5],
                heading: 90,
                speed: 30,
            });

            expect(redisMock.setEx).toHaveBeenCalledWith(
                'driver:location:driver123',
                60,
                expect.any(String)
            );
            expect(DriverLocation.findOneAndUpdate).toHaveBeenCalledWith(
                { driverId: 'driver123' },
                expect.objectContaining({ isOnline: true }),
                { upsert: true, new: true }
            );
            expect(result.driverId).toBe('driver123');
            expect(result.coordinates).toEqual([13.4, 52.5]);
            expect(result.heading).toBe(90);
        });

        it('should default heading and speed to 0 when omitted', async () => {
            DriverLocation.findOneAndUpdate.mockResolvedValue({});

            const result = await locationService.updateDriverLocation('driver123', {
                coordinates: [10, 20],
            });

            expect(result.heading).toBe(0);
            expect(result.speed).toBe(0);
        });
    });

    describe('getDriverLocation', () => {
        it('should return cached location from redis', async () => {
            const cached = { driverId: 'driver123', coordinates: [13.4, 52.5], heading: 45 };
            redisMock.get.mockResolvedValue(JSON.stringify(cached));

            const result = await locationService.getDriverLocation('driver123');

            expect(result).toEqual(cached);
            expect(DriverLocation.findOne).not.toHaveBeenCalled();
        });

        it('should fall back to mongo when redis cache is empty', async () => {
            redisMock.get.mockResolvedValue(null);
            DriverLocation.findOne.mockResolvedValue({
                location: { coordinates: [13.4, 52.5] },
                heading: 180,
            });

            const result = await locationService.getDriverLocation('driver123');

            expect(DriverLocation.findOne).toHaveBeenCalledWith({ driverId: 'driver123' });
            expect(result).toEqual({ coordinates: [13.4, 52.5], heading: 180 });
        });

        it('should return null when not found in redis or mongo', async () => {
            redisMock.get.mockResolvedValue(null);
            DriverLocation.findOne.mockResolvedValue(null);

            const result = await locationService.getDriverLocation('ghost123');

            expect(result).toBeNull();
        });
    });

    describe('findNearbyDrivers', () => {
        it('should return drivers via geo aggregation', async () => {
            const mockDrivers = [
                { driverId: 'driver1', distance: 120 },
                { driverId: 'driver2', distance: 450 },
            ];
            DriverLocation.aggregate.mockResolvedValue(mockDrivers);

            const result = await locationService.findNearbyDrivers({ lng: 13.4, lat: 52.5 });

            expect(DriverLocation.aggregate).toHaveBeenCalled();
            expect(result).toEqual(mockDrivers);
        });

        it('should use default maxDistance and limit', async () => {
            DriverLocation.aggregate.mockResolvedValue([]);

            await locationService.findNearbyDrivers({ lng: 13.4, lat: 52.5 });

            const [pipeline] = DriverLocation.aggregate.mock.calls[0];
            const geoNear = pipeline[0].$geoNear;
            expect(geoNear.maxDistance).toBe(5000);
        });
    });

    describe('setDriverOnlineStatus', () => {
        it('should update online status to true without clearing redis', async () => {
            DriverLocation.findOneAndUpdate.mockResolvedValue({});

            await locationService.setDriverOnlineStatus('driver123', true);

            expect(DriverLocation.findOneAndUpdate).toHaveBeenCalledWith(
                { driverId: 'driver123' },
                expect.objectContaining({ isOnline: true }),
                { upsert: true, new: true }
            );
            expect(redisMock.del).not.toHaveBeenCalled();
        });

        it('should clear redis cache when driver goes offline', async () => {
            DriverLocation.findOneAndUpdate.mockResolvedValue({});

            await locationService.setDriverOnlineStatus('driver123', false);

            expect(redisMock.del).toHaveBeenCalledWith('driver:location:driver123');
        });
    });

    describe('getOnlineDrivers', () => {
        it('should return all online drivers from mongo', async () => {
            const mockDrivers = [{ driverId: 'driver1' }, { driverId: 'driver2' }];
            DriverLocation.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockDrivers) });

            const result = await locationService.getOnlineDrivers();

            expect(DriverLocation.find).toHaveBeenCalledWith({ isOnline: true });
            expect(result).toEqual(mockDrivers);
        });
    });
});
