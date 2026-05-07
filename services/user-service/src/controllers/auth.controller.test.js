jest.mock('../models/user.model');
jest.mock('../models/driver.model');
jest.mock('../utils/jwt');
jest.mock('../config/redis');
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const User = require('../models/user.model');
const Driver = require('../models/driver.model');
const {
    generateTokens,
    saveRefreshToken,
    verifyRefreshToken,
    blacklistToken,
    deleteRefreshToken,
} = require('../utils/jwt');
const { getRedis } = require('../config/redis');
const { register, login, refresh, logout, getMe } = require('./auth.controller');

describe('Auth Controller', () => {
    let req, res, next;

    beforeEach(() => {
        req = { body: {}, cookies: {}, user: {}, headers: {}, token: null };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
            clearCookie: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new rider and return 201', async () => {
            req.body = { name: 'Alice', email: 'alice@test.com', password: 'pass1234', role: 'rider' };

            User.findOne.mockResolvedValue(null);
            User.create.mockResolvedValue({ _id: 'user123', ...req.body });
            generateTokens.mockReturnValue({ accessToken: 'acc', refreshToken: 'ref' });
            saveRefreshToken.mockResolvedValue();

            await register(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, message: 'Registration successful' })
            );
        });

        it('should create a Driver profile when role is driver', async () => {
            req.body = { name: 'Bob', email: 'bob@test.com', password: 'pass1234', role: 'driver' };

            User.findOne.mockResolvedValue(null);
            User.create.mockResolvedValue({ _id: 'driver123', ...req.body });
            Driver.create.mockResolvedValue({});
            generateTokens.mockReturnValue({ accessToken: 'acc', refreshToken: 'ref' });
            saveRefreshToken.mockResolvedValue();

            await register(req, res, next);

            expect(Driver.create).toHaveBeenCalledWith({ userId: 'driver123' });
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('should return 409 if email is already registered', async () => {
            req.body = { email: 'existing@test.com', password: 'pass1234' };
            User.findOne.mockResolvedValue({ email: 'existing@test.com' });

            await register(req, res, next);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, message: 'Email already registered' })
            );
        });

        it('should call next on unexpected error', async () => {
            User.findOne.mockRejectedValue(new Error('DB error'));

            await register(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('login', () => {
        const buildUserMock = (overrides = {}) => ({
            _id: 'user123',
            email: 'alice@test.com',
            role: 'rider',
            isActive: true,
            comparePassword: jest.fn().mockResolvedValue(true),
            password: 'hashed',
            ...overrides,
        });

        it('should return 200 with tokens on valid credentials', async () => {
            req.body = { email: 'alice@test.com', password: 'pass1234' };

            User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(buildUserMock()) });
            generateTokens.mockReturnValue({ accessToken: 'acc', refreshToken: 'ref' });
            saveRefreshToken.mockResolvedValue();

            await login(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, message: 'Login successful' })
            );
        });

        it('should return 401 if user does not exist', async () => {
            req.body = { email: 'nobody@test.com', password: 'pass1234' };
            User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

            await login(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 if account is deactivated', async () => {
            req.body = { email: 'banned@test.com', password: 'pass1234' };
            User.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(buildUserMock({ isActive: false })),
            });

            await login(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 401 on wrong password', async () => {
            req.body = { email: 'alice@test.com', password: 'wrongpass' };
            User.findOne.mockReturnValue({
                select: jest.fn().mockResolvedValue(
                    buildUserMock({ comparePassword: jest.fn().mockResolvedValue(false) })
                ),
            });

            await login(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe('refresh', () => {
        it('should return a new accessToken', async () => {
            req.cookies = { refreshToken: 'old-refresh' };

            verifyRefreshToken.mockReturnValue({ id: 'user123', role: 'rider' });
            const redisMock = { get: jest.fn().mockResolvedValue('old-refresh') };
            getRedis.mockReturnValue(redisMock);
            User.findById.mockResolvedValue({ _id: 'user123', isActive: true });
            generateTokens.mockReturnValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });
            saveRefreshToken.mockResolvedValue();

            await refresh(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, data: { accessToken: 'new-acc' } })
            );
        });

        it('should return 401 if no refresh token cookie', async () => {
            req.cookies = {};

            await refresh(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 if stored token does not match', async () => {
            req.cookies = { refreshToken: 'tampered-token' };
            verifyRefreshToken.mockReturnValue({ id: 'user123' });
            const redisMock = { get: jest.fn().mockResolvedValue('original-token') };
            getRedis.mockReturnValue(redisMock);

            await refresh(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 if user is inactive', async () => {
            req.cookies = { refreshToken: 'valid-refresh' };
            verifyRefreshToken.mockReturnValue({ id: 'user123' });
            const redisMock = { get: jest.fn().mockResolvedValue('valid-refresh') };
            getRedis.mockReturnValue(redisMock);
            User.findById.mockResolvedValue({ isActive: false });

            await refresh(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe('logout', () => {
        it('should blacklist token, clear cookie, and return 200', async () => {
            req.token = 'access-token-abc';
            req.user = { _id: 'user123' };
            blacklistToken.mockResolvedValue();
            deleteRefreshToken.mockResolvedValue();

            await logout(req, res, next);

            expect(blacklistToken).toHaveBeenCalledWith('access-token-abc', 15 * 60);
            expect(deleteRefreshToken).toHaveBeenCalledWith('user123');
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getMe', () => {
        it('should return the authenticated user', async () => {
            req.user = { _id: 'user123', name: 'Alice', email: 'alice@test.com', role: 'rider' };

            await getMe(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: { user: req.user } });
        });
    });
});
