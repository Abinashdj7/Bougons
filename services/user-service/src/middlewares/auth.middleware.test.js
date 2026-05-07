jest.mock('../utils/jwt');
jest.mock('../models/user.model');

const { verifyAccessToken, isTokenBlacklisted } = require('../utils/jwt');
const User = require('../models/user.model');
const { authenticate, authorize } = require('./auth.middleware');

describe('Auth Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('authenticate', () => {
        it('should attach user and call next with valid token', async () => {
            req.headers.authorization = 'Bearer valid-token';
            isTokenBlacklisted.mockResolvedValue(0);
            verifyAccessToken.mockReturnValue({ id: 'user123' });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ _id: 'user123', isActive: true }),
            });

            await authenticate(req, res, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.user).toEqual({ _id: 'user123', isActive: true });
            expect(req.token).toBe('valid-token');
        });

        it('should return 401 when Authorization header is missing', async () => {
            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when Authorization header does not start with Bearer', async () => {
            req.headers.authorization = 'Basic sometoken';

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 when token is blacklisted', async () => {
            req.headers.authorization = 'Bearer revoked-token';
            isTokenBlacklisted.mockResolvedValue(1);

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Token revoked' })
            );
        });

        it('should return 401 when user is not found', async () => {
            req.headers.authorization = 'Bearer valid-token';
            isTokenBlacklisted.mockResolvedValue(0);
            verifyAccessToken.mockReturnValue({ id: 'ghost123' });
            User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 when user account is inactive', async () => {
            req.headers.authorization = 'Bearer valid-token';
            isTokenBlacklisted.mockResolvedValue(0);
            verifyAccessToken.mockReturnValue({ id: 'banned123' });
            User.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue({ _id: 'banned123', isActive: false }),
            });

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 when token is expired', async () => {
            req.headers.authorization = 'Bearer expired-token';
            isTokenBlacklisted.mockResolvedValue(0);
            const err = new Error('jwt expired');
            err.name = 'TokenExpiredError';
            verifyAccessToken.mockImplementation(() => { throw err; });

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Token expired' })
            );
        });
    });

    describe('authorize', () => {
        it('should call next when user has an allowed role', () => {
            req.user = { role: 'admin' };
            authorize('admin', 'superuser')(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should return 403 when user role is not allowed', () => {
            req.user = { role: 'rider' };
            authorize('admin')(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 403 for driver trying to access rider-only route', () => {
            req.user = { role: 'driver' };
            authorize('rider')(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});
