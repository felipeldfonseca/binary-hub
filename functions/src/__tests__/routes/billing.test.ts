import request from 'supertest';
import express from 'express';
import billingRouter from '../../routes/billing';
import billingService from '../../services/billingService';

// Mock the billing service
jest.mock('../../services/billingService');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  (req as any).user = { uid: 'test-user-123', email: 'test@example.com' };
  next();
});

app.use('/billing', billingRouter);

const mockBillingService = billingService as jest.Mocked<typeof billingService>;

describe('Billing Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /billing/plans', () => {
    it('should return all subscription plans', async () => {
      const mockPlans = [
        {
          id: 'free',
          name: 'Free',
          price: 0,
          currency: 'BRL',
          interval: 'month',
          features: ['Basic features'],
          aiLimits: { individual_trade: 5, daily_report: 0, weekly_report: 0, pattern_analysis: 0 },
          stripePriceId: ''
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 97.00,
          currency: 'BRL',
          interval: 'month',
          features: ['Advanced features'],
          aiLimits: { individual_trade: 100, daily_report: 30, weekly_report: 4, pattern_analysis: 10 },
          stripePriceId: 'price_pro',
          cryptoPrice: { usdt: 19, usdc: 19 }
        }
      ];

      mockBillingService.getPlans.mockReturnValue(mockPlans as any);

      const response = await request(app)
        .get('/billing/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(2);
      expect(response.body.data.plans[0].stripePriceId).toBeUndefined(); // Should be excluded
    });
  });

  describe('POST /billing/create-customer', () => {
    it('should create a new customer', async () => {
      const mockCustomer = {
        id: 'customer_123',
        userId: 'test-user-123',
        stripeCustomerId: 'cus_123',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockBillingService.createCustomer.mockResolvedValue(mockCustomer as any);

      const response = await request(app)
        .post('/billing/create-customer')
        .send({ name: 'Test User' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customer).toEqual(mockCustomer);
      expect(mockBillingService.createCustomer).toHaveBeenCalledWith(
        'test-user-123',
        'test@example.com',
        'Test User'
      );
    });

    it('should handle service errors', async () => {
      mockBillingService.createCustomer.mockRejectedValue(new Error('Stripe error'));

      const response = await request(app)
        .post('/billing/create-customer')
        .send({ name: 'Test User' })
        .expect(400);

      expect(response.body.error).toBe('Stripe error');
    });
  });

  describe('POST /billing/create-subscription', () => {
    it('should create a new subscription', async () => {
      const mockResult = {
        subscriptionId: 'sub_123',
        clientSecret: 'pi_secret_123'
      };

      mockBillingService.createSubscription.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/billing/create-subscription')
        .send({ planId: 'pro', paymentMethodId: 'pm_123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockBillingService.createSubscription).toHaveBeenCalledWith(
        'test-user-123',
        'pro',
        'pm_123'
      );
    });

    it('should require planId', async () => {
      const response = await request(app)
        .post('/billing/create-subscription')
        .send({ paymentMethodId: 'pm_123' })
        .expect(400);

      expect(response.body.error).toBe('Plan ID is required');
    });

    it('should handle service errors', async () => {
      mockBillingService.createSubscription.mockRejectedValue(new Error('Invalid plan'));

      const response = await request(app)
        .post('/billing/create-subscription')
        .send({ planId: 'invalid', paymentMethodId: 'pm_123' })
        .expect(400);

      expect(response.body.error).toBe('Invalid plan');
    });
  });

  describe('POST /billing/cancel-subscription', () => {
    it('should cancel a subscription', async () => {
      mockBillingService.cancelSubscription.mockResolvedValue();

      const response = await request(app)
        .post('/billing/cancel-subscription')
        .send({ subscriptionId: 'sub_123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription canceled successfully');
      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith(
        'test-user-123',
        'sub_123'
      );
    });

    it('should require subscriptionId', async () => {
      const response = await request(app)
        .post('/billing/cancel-subscription')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Subscription ID is required');
    });
  });

  describe('GET /billing/subscription', () => {
    it('should return user subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'test-user-123',
        planId: 'pro',
        status: 'active'
      };

      const mockPlan = {
        id: 'pro',
        name: 'Pro',
        price: 97.00
      };

      mockBillingService.getUserSubscription.mockResolvedValue(mockSubscription as any);
      mockBillingService.getPlan.mockReturnValue(mockPlan as any);

      const response = await request(app)
        .get('/billing/subscription')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription).toEqual(mockSubscription);
      expect(response.body.data.plan).toEqual(mockPlan);
    });

    it('should return free plan when no subscription', async () => {
      const mockFreePlan = {
        id: 'free',
        name: 'Free',
        price: 0
      };

      mockBillingService.getUserSubscription.mockResolvedValue(null);
      mockBillingService.getPlan.mockReturnValue(mockFreePlan as any);

      const response = await request(app)
        .get('/billing/subscription')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription).toBeNull();
      expect(response.body.data.plan).toEqual(mockFreePlan);
    });
  });

  describe('GET /billing/history', () => {
    it('should return billing history', async () => {
      const mockHistory = [
        {
          id: 'in_123',
          amount: 97.00,
          currency: 'BRL',
          status: 'paid',
          created: '2024-01-01T00:00:00Z',
          description: 'Pro subscription'
        }
      ];

      mockBillingService.getBillingHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/billing/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toEqual(mockHistory);
      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith(
        'test-user-123',
        20
      );
    });

    it('should respect limit parameter', async () => {
      mockBillingService.getBillingHistory.mockResolvedValue([]);

      await request(app)
        .get('/billing/history?limit=10')
        .expect(200);

      expect(mockBillingService.getBillingHistory).toHaveBeenCalledWith(
        'test-user-123',
        10
      );
    });
  });

  describe('POST /billing/crypto/create-payment', () => {
    it('should create crypto payment', async () => {
      const mockPayment = {
        paymentId: 'crypto_123',
        amount: 19,
        address: '0x123...'
      };

      mockBillingService.createCryptoPayment.mockResolvedValue(mockPayment);

      const response = await request(app)
        .post('/billing/crypto/create-payment')
        .send({ planId: 'pro', currency: 'USDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPayment);
      expect(mockBillingService.createCryptoPayment).toHaveBeenCalledWith(
        'test-user-123',
        'pro',
        'USDT'
      );
    });

    it('should require planId and currency', async () => {
      const response = await request(app)
        .post('/billing/crypto/create-payment')
        .send({ planId: 'pro' })
        .expect(400);

      expect(response.body.error).toBe('Plan ID and currency are required');
    });

    it('should validate currency', async () => {
      const response = await request(app)
        .post('/billing/crypto/create-payment')
        .send({ planId: 'pro', currency: 'BTC' })
        .expect(400);

      expect(response.body.error).toBe('Invalid currency. Only USDT and USDC are supported');
    });
  });

  describe('GET /billing/usage', () => {
    it('should return usage statistics', async () => {
      const mockSubscription = {
        planId: 'pro',
        status: 'active'
      };

      const mockPlan = {
        id: 'pro',
        aiLimits: {
          individual_trade: 100,
          daily_report: 30,
          weekly_report: 4,
          pattern_analysis: 10
        }
      };

      mockBillingService.getUserSubscription.mockResolvedValue(mockSubscription as any);
      mockBillingService.getPlan.mockReturnValue(mockPlan as any);

      const response = await request(app)
        .get('/billing/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.planId).toBe('pro');
      expect(response.body.data.plan.id).toBe('pro');
      expect(response.body.data.limits).toEqual(mockPlan.aiLimits);
    });

    it('should return free tier defaults when no subscription', async () => {
      const mockFreePlan = {
        id: 'free',
        aiLimits: {
          individual_trade: 5,
          daily_report: 0,
          weekly_report: 0,
          pattern_analysis: 0
        }
      };

      mockBillingService.getUserSubscription.mockResolvedValue(null);
      mockBillingService.getPlan.mockReturnValue(mockFreePlan as any);

      const response = await request(app)
        .get('/billing/usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.planId).toBe('free');
      expect(response.body.data.limits).toEqual(mockFreePlan.aiLimits);
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors', async () => {
      mockBillingService.getPlans.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/billing/plans')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle missing authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/billing', billingRouter);

      const response = await request(appWithoutAuth)
        .get('/billing/subscription')
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });
  });
});