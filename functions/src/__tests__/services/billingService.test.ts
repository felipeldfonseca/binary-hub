import { BillingService } from '../../services/billingService';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

// Mock Firebase Firestore
jest.mock('firebase-admin/firestore');
jest.mock('stripe');

const mockFirestore = {
  collection: jest.fn(() => ({
    where: jest.fn(() => ({
      get: jest.fn(),
      limit: jest.fn(() => ({
        get: jest.fn()
      }))
    })),
    doc: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      get: jest.fn()
    }))
  })),
  doc: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn()
  }))
};

const mockStripe = {
  customers: {
    create: jest.fn()
  },
  subscriptions: {
    create: jest.fn(),
    update: jest.fn(),
    retrieve: jest.fn()
  },
  invoices: {
    list: jest.fn()
  },
  paymentIntents: {
    create: jest.fn()
  },
  billingPortal: {
    sessions: {
      create: jest.fn()
    }
  },
  webhooks: {
    constructEvent: jest.fn()
  }
};

(getFirestore as jest.Mock).mockReturnValue(mockFirestore);
(Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe as any);

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    billingService = new BillingService();
  });

  describe('getPlans', () => {
    it('should return all subscription plans', () => {
      const plans = billingService.getPlans();
      
      expect(plans).toHaveLength(3);
      expect(plans.map(p => p.id)).toEqual(['free', 'pro', 'premium']);
      expect(plans[0].price).toBe(0);
      expect(plans[1].price).toBe(97.00);
      expect(plans[2].price).toBe(147.00);
    });

    it('should include AI limits for each plan', () => {
      const plans = billingService.getPlans();
      
      plans.forEach(plan => {
        expect(plan.aiLimits).toBeDefined();
        expect(plan.aiLimits).toHaveProperty('individual_trade');
        expect(plan.aiLimits).toHaveProperty('daily_report');
        expect(plan.aiLimits).toHaveProperty('weekly_report');
        expect(plan.aiLimits).toHaveProperty('pattern_analysis');
      });
    });
  });

  describe('getPlan', () => {
    it('should return correct plan by ID', () => {
      const proPlan = billingService.getPlan('pro');
      
      expect(proPlan).toBeDefined();
      expect(proPlan?.id).toBe('pro');
      expect(proPlan?.price).toBe(97.00);
      expect(proPlan?.aiLimits.individual_trade).toBe(100);
    });

    it('should return undefined for invalid plan ID', () => {
      const invalidPlan = billingService.getPlan('invalid');
      expect(invalidPlan).toBeUndefined();
    });
  });

  describe('createCustomer', () => {
    it('should return existing customer if found', async () => {
      const existingCustomer = {
        id: 'stripe_customer_123',
        userId: 'user_123',
        stripeCustomerId: 'stripe_customer_123',
        email: 'test@example.com'
      };

      mockFirestore.collection().where().get.mockResolvedValue({
        empty: false,
        docs: [{ data: () => existingCustomer }]
      });

      const result = await billingService.createCustomer('user_123', 'test@example.com');
      
      expect(result).toEqual(existingCustomer);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer if not found', async () => {
      mockFirestore.collection().where().get.mockResolvedValue({
        empty: true,
        docs: []
      });

      const newStripeCustomer = {
        id: 'stripe_customer_456',
        email: 'new@example.com'
      };

      mockStripe.customers.create.mockResolvedValue(newStripeCustomer);

      const result = await billingService.createCustomer('user_456', 'new@example.com', 'Test User');
      
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'Test User',
        metadata: {
          userId: 'user_456'
        }
      });

      expect(mockFirestore.collection().doc().set).toHaveBeenCalled();
      expect(result.stripeCustomerId).toBe('stripe_customer_456');
      expect(result.userId).toBe('user_456');
    });

    it('should handle errors gracefully', async () => {
      mockFirestore.collection().where().get.mockRejectedValue(new Error('Database error'));

      await expect(billingService.createCustomer('user_123', 'test@example.com'))
        .rejects.toThrow('Failed to create customer');
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const mockUser = {
        email: 'test@example.com',
        displayName: 'Test User'
      };

      const mockCustomer = {
        id: 'customer_123',
        stripeCustomerId: 'stripe_customer_123'
      };

      const mockSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
        latest_invoice: {
          payment_intent: {
            client_secret: 'pi_secret_123'
          }
        }
      };

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUser
      });

      jest.spyOn(billingService, 'createCustomer').mockResolvedValue(mockCustomer as any);
      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.createSubscription('user_123', 'pro', 'pm_123');

      expect(result.subscriptionId).toBe('sub_123');
      expect(result.clientSecret).toBe('pi_secret_123');
      expect(mockFirestore.collection().doc().set).toHaveBeenCalled();
      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
    });

    it('should reject invalid plan', async () => {
      await expect(billingService.createSubscription('user_123', 'invalid', 'pm_123'))
        .rejects.toThrow('Invalid plan');
    });

    it('should reject free plan', async () => {
      await expect(billingService.createSubscription('user_123', 'free', 'pm_123'))
        .rejects.toThrow('Invalid plan');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const mockSubscription = {
        userId: 'user_123',
        stripeSubscriptionId: 'sub_123'
      };

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockSubscription
      });

      mockStripe.subscriptions.update.mockResolvedValue({});

      await billingService.cancelSubscription('user_123', 'sub_123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true
      });

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        status: 'canceled',
        updatedAt: expect.any(String)
      });
    });

    it('should reject unauthorized cancellation', async () => {
      const mockSubscription = {
        userId: 'other_user',
        stripeSubscriptionId: 'sub_123'
      };

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockSubscription
      });

      await expect(billingService.cancelSubscription('user_123', 'sub_123'))
        .rejects.toThrow('Unauthorized');
    });

    it('should reject non-existent subscription', async () => {
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: false
      });

      await expect(billingService.cancelSubscription('user_123', 'sub_123'))
        .rejects.toThrow('Subscription not found');
    });
  });

  describe('getUserSubscription', () => {
    it('should return active subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        status: 'active',
        planId: 'pro'
      };

      mockFirestore.collection().where().where().orderBy().limit().get.mockResolvedValue({
        empty: false,
        docs: [{ data: () => mockSubscription }]
      });

      const result = await billingService.getUserSubscription('user_123');

      expect(result).toEqual(mockSubscription);
    });

    it('should return null if no active subscription', async () => {
      mockFirestore.collection().where().where().orderBy().limit().get.mockResolvedValue({
        empty: true,
        docs: []
      });

      const result = await billingService.getUserSubscription('user_123');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockFirestore.collection().where().where().orderBy().limit().get.mockRejectedValue(
        new Error('Database error')
      );

      const result = await billingService.getUserSubscription('user_123');

      expect(result).toBeNull();
    });
  });

  describe('createCryptoPayment', () => {
    it('should create crypto payment record', async () => {
      const result = await billingService.createCryptoPayment('user_123', 'pro', 'USDT');

      expect(result.amount).toBe(19);
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.paymentId).toMatch(/^crypto_/);
      expect(mockFirestore.collection().doc().set).toHaveBeenCalled();
    });

    it('should reject invalid currency', async () => {
      await expect(billingService.createCryptoPayment('user_123', 'pro', 'BTC' as any))
        .rejects.toThrow('Invalid plan or crypto not supported');
    });

    it('should reject free plan', async () => {
      await expect(billingService.createCryptoPayment('user_123', 'free', 'USDT'))
        .rejects.toThrow('Invalid plan or crypto not supported');
    });
  });

  describe('handleWebhook', () => {
    it('should handle subscription update event', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            metadata: {
              userId: 'user_123',
              planId: 'pro'
            }
          }
        }
      };

      await billingService.handleWebhook(mockEvent as any);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        status: 'active',
        currentPeriodStart: expect.any(String),
        currentPeriodEnd: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('should handle payment success event', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_123'
          }
        }
      };

      // Should not throw
      await expect(billingService.handleWebhook(mockEvent as any)).resolves.toBeUndefined();
    });

    it('should handle unknown event types', async () => {
      const mockEvent = {
        type: 'unknown.event',
        data: {
          object: {}
        }
      };

      // Should not throw
      await expect(billingService.handleWebhook(mockEvent as any)).resolves.toBeUndefined();
    });
  });
});