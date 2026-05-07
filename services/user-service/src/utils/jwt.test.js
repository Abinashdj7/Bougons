jest.mock('../config/redis');

const { getRedis } = require('../config/redis');

process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const {
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    saveRefreshToken,
    blacklistToken,
    isTokenBlacklisted,
    deleteRefreshToken,
} = require('./jwt');

describe('JWT Utils', () => {
    let redisMock;

    beforeEach(() => {
        redisMock = {
            setEx: jest.fn().mockResolvedValue('OK'),
            exists: jest.fn().mockResolvedValue(0),
            del: jest.fn().mockResolvedValue(1),
        };
        getRedis.mockReturnValue(redisMock);
        jest.clearAllMocks();
        getRedis.mockReturnValue(redisMock);
    });

    describe('generateTokens', () => {
        it('should return an accessToken and refreshToken', () => {
            const tokens = generateTokens({ id: 'user123', role: 'rider' });
            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('refreshToken');
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.refreshToken).toBe('string');
        });

        it('should generate distinct tokens for different payloads', () => {
            const a = generateTokens({ id: 'user1', role: 'rider' });
            const b = generateTokens({ id: 'user2', role: 'driver' });
            expect(a.accessToken).not.toBe(b.accessToken);
        });
    });

    describe('verifyAccessToken', () => {
        it('should decode a valid access token', () => {
            const { accessToken } = generateTokens({ id: 'user123', role: 'rider' });
            const decoded = verifyAccessToken(accessToken);
            expect(decoded.id).toBe('user123');
            expect(decoded.role).toBe('rider');
        });

        it('should throw on an invalid token string', () => {
            expect(() => verifyAccessToken('not.a.valid.token')).toThrow();
        });

        it('should throw when signed with wrong secret', () => {
            const jwt = require('jsonwebtoken');
            const bad = jwt.sign({ id: 'user123' }, 'wrong-secret');
            expect(() => verifyAccessToken(bad)).toThrow();
        });
    });

    describe('verifyRefreshToken', () => {
        it('should decode a valid refresh token', () => {
            const { refreshToken } = generateTokens({ id: 'user123', role: 'driver' });
            const decoded = verifyRefreshToken(refreshToken);
            expect(decoded.id).toBe('user123');
            expect(decoded.role).toBe('driver');
        });

        it('should throw on an invalid refresh token', () => {
            expect(() => verifyRefreshToken('bad-token')).toThrow();
        });
    });

    describe('saveRefreshToken', () => {
        it('should call redis.setEx with correct key and TTL', async () => {
            await saveRefreshToken('user123', 'myRefreshToken');
            expect(redisMock.setEx).toHaveBeenCalledWith(
                'refresh:user123',
                7 * 24 * 60 * 60,
                'myRefreshToken'
            );
        });
    });

    describe('blacklistToken', () => {
        it('should call redis.setEx to blacklist the token', async () => {
            await blacklistToken('access-token-xyz', 900);
            expect(redisMock.setEx).toHaveBeenCalledWith(
                'blacklist:access-token-xyz',
                900,
                'true'
            );
        });
    });

    describe('isTokenBlacklisted', () => {
        it('should return 1 when token is blacklisted', async () => {
            redisMock.exists.mockResolvedValue(1);
            const result = await isTokenBlacklisted('blacklisted-token');
            expect(result).toBe(1);
            expect(redisMock.exists).toHaveBeenCalledWith('blacklist:blacklisted-token');
        });

        it('should return 0 when token is not blacklisted', async () => {
            redisMock.exists.mockResolvedValue(0);
            const result = await isTokenBlacklisted('clean-token');
            expect(result).toBe(0);
        });
    });

    describe('deleteRefreshToken', () => {
        it('should call redis.del with correct key', async () => {
            await deleteRefreshToken('user123');
            expect(redisMock.del).toHaveBeenCalledWith('refresh:user123');
        });
    });
});
