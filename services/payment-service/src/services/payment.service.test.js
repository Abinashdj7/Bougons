jest.mock('stripe');
jest.mock('../models/payment.model');
jest.mock('axios');
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const Stripe = require('stripe');
const Payment = require('../models/payment.model');
const axios = require('axios');

const mockStripeInstance = {
    paymentIntents: {
        create: jest.fn(),
        retrieve: jest.fn(),
    },
    refunds: {
        create: jest.fn(),
    },
};
Stripe.mockImplementation(() => mockStripeInstance);

process.env.STRIPE_SECRET_KEY = 'sk_test_key';
process.env.NOTIFICATION_SERVICE_URL = 'http://notification:4005';
process.env.INTERNAL_SECRET = 'internal-secret';

const paymentService = require('./payment.service');

describe('Payment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPaymentIntent', () => {
        it('should return existing payment without hitting Stripe if already created', async () => {
            const existing = { _id: 'pay123', rideId: 'ride123' };
            Payment.findOne.mockResolvedValue(existing);

            const result = await paymentService.createPaymentIntent({
                rideId: 'ride123', riderId: 'rider123', driverId: 'driver123', amount: 12.5,
            });

            expect(result).toEqual(existing);
            expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
        });

        it('should create a Stripe intent and a Payment record', async () => {
            Payment.findOne.mockResolvedValue(null);
            mockStripeInstance.paymentIntents.create.mockResolvedValue({
                id: 'pi_123',
                client_secret: 'secret_xyz',
            });
            const mockPayment = { _id: 'pay123', rideId: 'ride123', amount: 12.5 };
            Payment.create.mockResolvedValue(mockPayment);

            const result = await paymentService.createPaymentIntent({
                rideId: 'ride123', riderId: 'rider123', driverId: 'driver123', amount: 12.5,
            });

            expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({ amount: 1250, currency: 'eur' })
            );
            expect(Payment.create).toHaveBeenCalled();
            expect(result.payment).toEqual(mockPayment);
            expect(result.clientSecret).toBe('secret_xyz');
        });

        it('should convert amount to cents correctly', async () => {
            Payment.findOne.mockResolvedValue(null);
            mockStripeInstance.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 's' });
            Payment.create.mockResolvedValue({});

            await paymentService.createPaymentIntent({
                rideId: 'ride1', riderId: 'rider1', driverId: 'driver1', amount: 9.99,
            });

            expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
                expect.objectContaining({ amount: 999 })
            );
        });
    });

    describe('confirmPayment', () => {
        it('should mark payment as succeeded when Stripe status is succeeded', async () => {
            mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
                status: 'succeeded',
                latest_charge: 'ch_123',
            });
            const mockPayment = { _id: 'pay123', riderId: 'rider123', amount: 12.5, status: 'succeeded' };
            Payment.findOneAndUpdate.mockResolvedValue(mockPayment);
            axios.post.mockResolvedValue({ data: {} });

            const result = await paymentService.confirmPayment('pi_123');

            expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
                { stripePaymentIntentId: 'pi_123' },
                { status: 'succeeded', stripeChargeId: 'ch_123' },
                { new: true }
            );
            expect(result.status).toBe('succeeded');
        });

        it('should mark payment as failed when Stripe status is not succeeded', async () => {
            mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
                status: 'requires_payment_method',
                latest_charge: null,
            });
            Payment.findOneAndUpdate.mockResolvedValue({ status: 'failed' });

            const result = await paymentService.confirmPayment('pi_123');

            expect(result.status).toBe('failed');
        });

        it('should throw when payment record is not found', async () => {
            mockStripeInstance.paymentIntents.retrieve.mockResolvedValue({
                status: 'succeeded',
                latest_charge: 'ch_1',
            });
            Payment.findOneAndUpdate.mockResolvedValue(null);

            await expect(paymentService.confirmPayment('pi_missing')).rejects.toThrow('Payment not found');
        });
    });

    describe('refundPayment', () => {
        it('should process refund for a succeeded payment', async () => {
            const mockPayment = {
                _id: 'pay123',
                status: 'succeeded',
                stripeChargeId: 'ch_123',
                amount: 12.5,
                updateOne: jest.fn().mockResolvedValue({}),
            };
            Payment.findById.mockResolvedValue(mockPayment);
            mockStripeInstance.refunds.create.mockResolvedValue({ id: 're_123' });

            const result = await paymentService.refundPayment('pay123', 'Customer request');

            expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
                charge: 'ch_123',
                reason: 'requested_by_customer',
            });
            expect(mockPayment.updateOne).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'refunded' })
            );
            expect(result.id).toBe('re_123');
        });

        it('should throw when payment is not found', async () => {
            Payment.findById.mockResolvedValue(null);

            await expect(paymentService.refundPayment('bad-id')).rejects.toThrow('Payment not found');
        });

        it('should throw when payment is not in succeeded state', async () => {
            Payment.findById.mockResolvedValue({ status: 'pending' });

            await expect(paymentService.refundPayment('pay123')).rejects.toThrow('not eligible for refund');
        });
    });

    describe('getPaymentHistory', () => {
        it('should query by riderId for rider role', async () => {
            const mockPayments = [{ _id: 'p1' }, { _id: 'p2' }];
            Payment.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockPayments),
            });

            const result = await paymentService.getPaymentHistory('user123', 'rider', 1, 10);

            expect(Payment.find).toHaveBeenCalledWith({ riderId: 'user123' });
            expect(result).toEqual(mockPayments);
        });

        it('should query by driverId for driver role', async () => {
            Payment.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            });

            await paymentService.getPaymentHistory('driver123', 'driver');

            expect(Payment.find).toHaveBeenCalledWith({ driverId: 'driver123' });
        });
    });

    describe('getDriverEarnings', () => {
        it('should compute total and breakdown by day', async () => {
            const mockPayments = [
                { amount: 10, createdAt: new Date('2024-03-01T10:00:00Z') },
                { amount: 15, createdAt: new Date('2024-03-01T18:00:00Z') },
                { amount: 20, createdAt: new Date('2024-03-02T09:00:00Z') },
            ];
            Payment.find.mockResolvedValue(mockPayments);

            const result = await paymentService.getDriverEarnings('driver123');

            expect(Payment.find).toHaveBeenCalledWith({ driverId: 'driver123', status: 'succeeded' });
            expect(result.total).toBe(45);
            expect(result.count).toBe(3);
            expect(result.byDay['2024-03-01']).toBe(25);
            expect(result.byDay['2024-03-02']).toBe(20);
        });

        it('should return zero totals when no payments exist', async () => {
            Payment.find.mockResolvedValue([]);

            const result = await paymentService.getDriverEarnings('driver123');

            expect(result.total).toBe(0);
            expect(result.count).toBe(0);
        });
    });

    describe('getPlatformRevenue', () => {
        it('should return aggregated revenue stats', async () => {
            const mockResult = [{ total: 1000, count: 50, avgFare: 20 }];
            Payment.aggregate.mockResolvedValue(mockResult);

            const result = await paymentService.getPlatformRevenue();

            expect(result).toEqual(mockResult[0]);
        });

        it('should return zeros when no succeeded payments exist', async () => {
            Payment.aggregate.mockResolvedValue([]);

            const result = await paymentService.getPlatformRevenue();

            expect(result).toEqual({ total: 0, count: 0, avgFare: 0 });
        });
    });
});
