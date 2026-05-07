const { calculateFare, haversineDistance, estimateDuration, getSurgeMultiplier } = require('../../src/utils/fareCalculator');

describe('Fare Calculator', () => {
    describe('haversineDistance', () => {
        it('should calculate distance between two coordinates', () => {

            const berlin = [13.405, 52.52];
            const munich = [11.58, 48.1];
            const distance = haversineDistance(berlin, munich);
            expect(distance).toBeGreaterThan(490);
            expect(distance).toBeLessThan(520);
        });

        it('should return 0 for same coordinates', () => {
            const coord = [13.405, 52.52];
            const distance = haversineDistance(coord, coord);
            expect(distance).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const sydney = [151.2093, -33.8688];
            const melbourne = [144.9630, -37.8136];
            const distance = haversineDistance(sydney, melbourne);
            expect(distance).toBeGreaterThan(700);
            expect(distance).toBeLessThan(850);
        });
    });

    describe('estimateDuration', () => {
        it('should estimate duration based on distance', () => {
            const duration = estimateDuration(10);
            expect(duration).toBeGreaterThan(15);
            expect(duration).toBeLessThan(25);
        });

        it('should handle short distances', () => {
            const duration = estimateDuration(1);
            expect(duration).toBeGreaterThanOrEqual(1);
            expect(duration).toBeLessThanOrEqual(5);
        });

        it('should handle long distances', () => {
            const duration = estimateDuration(100);
            expect(duration).toBeGreaterThan(180);
            expect(duration).toBeLessThan(210);
        });
    });

    describe('calculateFare', () => {
        it('should calculate fare for a short ride', () => {
            const pickup = [13.405, 52.52];
            const destination = [13.42, 52.54];
            const fare = calculateFare(pickup, destination, 1.0);

            expect(fare).toHaveProperty('distance');
            expect(fare).toHaveProperty('duration');
            expect(fare).toHaveProperty('estimated');
            expect(fare).toHaveProperty('surgeMultiplier', 1.0);
            expect(fare).toHaveProperty('breakdown');
            expect(fare.estimated).toBeGreaterThanOrEqual(5.0);
        });

        it('should apply surge multiplier', () => {
            const pickup = [13.405, 52.52];
            const destination = [13.42, 52.54];
            const fareNormal = calculateFare(pickup, destination, 1.0);
            const fareSurge = calculateFare(pickup, destination, 1.5);

            expect(fareSurge.estimated).toBeGreaterThan(fareNormal.estimated);
            expect(fareSurge.surgeMultiplier).toBe(1.5);
        });

        it('should enforce minimum fare', () => {

            const pickup = [13.405, 52.52];
            const destination = [13.407, 52.521];
            const fare = calculateFare(pickup, destination, 0.1);

            expect(fare.estimated).toBeGreaterThanOrEqual(5.0);
        });

        it('should have correct fare breakdown', () => {
            const pickup = [13.405, 52.52];
            const destination = [13.45, 52.56];
            const fare = calculateFare(pickup, destination, 1.0);

            expect(fare.breakdown.baseFare).toBe(2.5);
            expect(fare.breakdown.distanceFare).toBeGreaterThan(0);
            expect(fare.breakdown.timeFare).toBeGreaterThan(0);
        });
    });

    describe('getSurgeMultiplier', () => {
        it('should return 1.0 for 0-15 active rides', () => {
            expect(getSurgeMultiplier(0)).toBe(1.0);
            expect(getSurgeMultiplier(10)).toBe(1.0);
            expect(getSurgeMultiplier(15)).toBe(1.0);
        });

        it('should return 1.25 for 16-30 active rides', () => {
            expect(getSurgeMultiplier(16)).toBe(1.25);
            expect(getSurgeMultiplier(25)).toBe(1.25);
            expect(getSurgeMultiplier(30)).toBe(1.25);
        });

        it('should return 1.5 for 31-50 active rides', () => {
            expect(getSurgeMultiplier(31)).toBe(1.5);
            expect(getSurgeMultiplier(40)).toBe(1.5);
            expect(getSurgeMultiplier(50)).toBe(1.5);
        });

        it('should return 2.0 for 50+ active rides', () => {
            expect(getSurgeMultiplier(51)).toBe(2.0);
            expect(getSurgeMultiplier(100)).toBe(2.0);
        });
    });
});
