jest.mock('../services/location.service');

const locationService = require('../services/location.service');
const {
    updateLocation,
    getNearbyDrivers,
    getDriverLocation,
    setOnlineStatus,
    getOnlineDrivers,
} = require('./location.controller');

describe('Location Controller', () => {
    let req, res, next;

    beforeEach(() => {
        req = { body: {}, query: {}, params: {}, user: { id: 'driver123' } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('updateLocation', () => {
        it('should return 200 with updated location data', async () => {
            req.body = { coordinates: [13.4, 52.5], heading: 90, speed: 30 };
            locationService.updateDriverLocation.mockResolvedValue({
                driverId: 'driver123',
                coordinates: [13.4, 52.5],
            });

            await updateLocation(req, res, next);

            expect(locationService.updateDriverLocation).toHaveBeenCalledWith(
                'driver123',
                { coordinates: [13.4, 52.5], heading: 90, speed: 30 }
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.any(Object) });
        });

        it('should return 400 when coordinates are missing', async () => {
            req.body = { heading: 90 };

            await updateLocation(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(locationService.updateDriverLocation).not.toHaveBeenCalled();
        });

        it('should return 400 when coordinates array length is not 2', async () => {
            req.body = { coordinates: [13.4] };

            await updateLocation(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should call next on unexpected error', async () => {
            req.body = { coordinates: [13.4, 52.5] };
            locationService.updateDriverLocation.mockRejectedValue(new Error('Redis error'));

            await updateLocation(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('getNearbyDrivers', () => {
        it('should return 200 with nearby drivers', async () => {
            req.query = { lng: '13.4', lat: '52.5', maxDistance: '3000' };
            locationService.findNearbyDrivers.mockResolvedValue([
                { driverId: 'driver1', distance: 200 },
            ]);

            await getNearbyDrivers(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { drivers: [{ driverId: 'driver1', distance: 200 }] },
            });
        });

        it('should return 400 when lng is missing', async () => {
            req.query = { lat: '52.5' };

            await getNearbyDrivers(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 when lat is missing', async () => {
            req.query = { lng: '13.4' };

            await getNearbyDrivers(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getDriverLocation', () => {
        it('should return 200 with driver location', async () => {
            req.params = { id: 'driver123' };
            locationService.getDriverLocation.mockResolvedValue({ coordinates: [13.4, 52.5] });

            await getDriverLocation(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { location: { coordinates: [13.4, 52.5] } },
            });
        });

        it('should return 404 when driver location is not found', async () => {
            req.params = { id: 'ghost123' };
            locationService.getDriverLocation.mockResolvedValue(null);

            await getDriverLocation(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('setOnlineStatus', () => {
        it('should set driver online and return 200', async () => {
            req.body = { isOnline: true };
            locationService.setDriverOnlineStatus.mockResolvedValue();

            await setOnlineStatus(req, res, next);

            expect(locationService.setDriverOnlineStatus).toHaveBeenCalledWith('driver123', true);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, data: { isOnline: true } })
            );
        });

        it('should set driver offline and return 200', async () => {
            req.body = { isOnline: false };
            locationService.setDriverOnlineStatus.mockResolvedValue();

            await setOnlineStatus(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 when isOnline is not a boolean', async () => {
            req.body = { isOnline: 'yes' };

            await setOnlineStatus(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(locationService.setDriverOnlineStatus).not.toHaveBeenCalled();
        });

        it('should return 400 when isOnline is a number', async () => {
            req.body = { isOnline: 1 };

            await setOnlineStatus(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getOnlineDrivers', () => {
        it('should return 200 with all online drivers', async () => {
            const drivers = [{ driverId: 'driver1' }, { driverId: 'driver2' }];
            locationService.getOnlineDrivers.mockResolvedValue(drivers);

            await getOnlineDrivers(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { drivers, count: 2 },
            });
        });
    });
});
