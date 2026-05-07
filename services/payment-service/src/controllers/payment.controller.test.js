jest.mock('../services/payment.service');
jest.mock('stripe');
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const paymentService = require('../services/payment.service');
const Stripe = require('stripe');

const mockWebhooks = { constructEvent: jest.fn() };
Stripe.mockImplementation(() => ({ webhooks: mockWebhooks }));

const {
    createIntent,
    confirmPayment,
    refundPayment,
    getHistory,
    getEarnings,
    getRevenue,
    handleWebhook,
} = require('./payment.controller');

describe('Payment Controller', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            body: {},
            query: {},
            params: {},
            headers: {},
            user: { id: 'user123', role: 'rider' },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('createIntent', () => {
        it('should return 201 with payment intent data', async () => {
            req.body = { rideId: 'ride123', driverId: 'driver123', amount: 12.5 };
            paymentService.createPaymentIntent.mockResolvedValue({
                clientSecret: 'secret_xyz',
                payment: { _id: 'pay123' },
            });

            await createIntent(req, res, next);

            expect(paymentService.createPaymentIntent).toHaveBeenCalledWith({
                rideId: 'ride123',
                riderId: 'user123',
                driverId: 'driver123',
                amount: 12.5,
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should return 400 when rideId is missing', async () => {
            req.body = { amount: 12.5 };

            await createIntent(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(paymentService.createPaymentIntent).not.toHaveBeenCalled();
        });

        it('should return 400 when amount is missing', async () => {
            req.body = { rideId: 'ride123' };

            await createIntent(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should call next on unexpected error', async () => {
            req.body = { rideId: 'ride123', amount: 12.5 };
            paymentService.createPaymentIntent.mockRejectedValue(new Error('Stripe error'));

            await createIntent(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('confirmPayment', () => {
        it('should return 200 with confirmed payment', async () => {
            req.body = { paymentIntentId: 'pi_123' };
            paymentService.confirmPayment.mockResolvedValue({ _id: 'pay123', status: 'succeeded' });

            await confirmPayment(req, res, next);

            expect(paymentService.confirmPayment).toHaveBeenCalledWith('pi_123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { payment: { _id: 'pay123', status: 'succeeded' } },
            });
        });

        it('should call next on error', async () => {
            req.body = { paymentIntentId: 'pi_bad' };
            paymentService.confirmPayment.mockRejectedValue(new Error('Not found'));

            await confirmPayment(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('refundPayment', () => {
        it('should return 200 with refund data', async () => {
            req.params = { id: 'pay123' };
            req.body = { reason: 'Customer request' };
            paymentService.refundPayment.mockResolvedValue({ id: 're_123' });

            await refundPayment(req, res, next);

            expect(paymentService.refundPayment).toHaveBeenCalledWith('pay123', 'Customer request');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { refund: { id: 're_123' } },
            });
        });
    });

    describe('getHistory', () => {
        it('should return 200 with payment history', async () => {
            req.query = { page: '1', limit: '10' };
            const mockPayments = [{ _id: 'p1' }, { _id: 'p2' }];
            paymentService.getPaymentHistory.mockResolvedValue(mockPayments);

            await getHistory(req, res, next);

            expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('user123', 'rider', '1', '10');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: { payments: mockPayments },
            });
        });
    });

    describe('getEarnings', () => {
        it('should return 200 with driver earnings', async () => {
            const mockEarnings = { total: 150, byDay: {}, count: 10 };
            paymentService.getDriverEarnings.mockResolvedValue(mockEarnings);

            await getEarnings(req, res, next);

            expect(paymentService.getDriverEarnings).toHaveBeenCalledWith('user123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: mockEarnings });
        });
    });

    describe('getRevenue', () => {
        it('should return 200 with platform revenue', async () => {
            const mockRevenue = { total: 5000, count: 200, avgFare: 25 };
            paymentService.getPlatformRevenue.mockResolvedValue(mockRevenue);

            await getRevenue(req, res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRevenue });
        });
    });

    describe('handleWebhook', () => {
        it('should process payment_intent.succeeded event', async () => {
            req.headers['stripe-signature'] = 'sig_valid';
            req.body = Buffer.from('{}');
            mockWebhooks.constructEvent.mockReturnValue({
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_123' } },
            });
            paymentService.confirmPayment.mockResolvedValue({});

            await handleWebhook(req, res);

            expect(paymentService.confirmPayment).toHaveBeenCalledWith('pi_123');
            expect(res.json).toHaveBeenCalledWith({ received: true });
        });

        it('should ignore unrelated event types', async () => {
            req.headers['stripe-signature'] = 'sig_valid';
            req.body = Buffer.from('{}');
            mockWebhooks.constructEvent.mockReturnValue({
                type: 'customer.created',
                data: { object: {} },
            });

            await handleWebhook(req, res);

            expect(paymentService.confirmPayment).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ received: true });
        });

        it('should return 400 on invalid Stripe signature', async () => {
            req.headers['stripe-signature'] = 'bad-sig';
            req.body = Buffer.from('{}');
            mockWebhooks.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            await handleWebhook(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});
