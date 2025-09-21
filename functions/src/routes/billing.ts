import { Router, Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import billingService from '../services/billingService';
import Stripe from 'stripe';

const db = getFirestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

const router = Router();

/**
 * GET /billing/plans - Get available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = billingService.getPlans();
    
    return res.json({
      success: true,
      data: {
        plans: plans.map(plan => ({
          ...plan,
          stripePriceId: undefined // Don't expose Stripe price IDs to frontend
        }))
      }
    });
  } catch (error: any) {
    logger.error('Get plans error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /billing/create-customer - Create or get billing customer
 */
router.post('/create-customer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { name } = req.body;
    
    const customer = await billingService.createCustomer(
      req.user.uid,
      req.user.email || '',
      name
    );

    return res.json({
      success: true,
      data: { customer }
    });
  } catch (error: any) {
    logger.error('Create customer error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /billing/create-subscription - Create new subscription
 */
router.post('/create-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { planId, paymentMethodId } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const result = await billingService.createSubscription(
      req.user.uid,
      planId,
      paymentMethodId
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Create subscription error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /billing/cancel-subscription - Cancel subscription
 */
router.post('/cancel-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    await billingService.cancelSubscription(req.user.uid, subscriptionId);

    return res.json({
      success: true,
      message: 'Subscription canceled successfully'
    });
  } catch (error: any) {
    logger.error('Cancel subscription error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /billing/update-subscription - Update subscription plan
 */
router.post('/update-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { subscriptionId, newPlanId } = req.body;
    
    if (!subscriptionId || !newPlanId) {
      return res.status(400).json({ error: 'Subscription ID and new plan ID are required' });
    }

    await billingService.updateSubscription(req.user.uid, subscriptionId, newPlanId);

    return res.json({
      success: true,
      message: 'Subscription updated successfully'
    });
  } catch (error: any) {
    logger.error('Update subscription error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /billing/subscription - Get user's current subscription
 */
router.get('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await billingService.getUserSubscription(req.user.uid);
    const plan = subscription ? billingService.getPlan(subscription.planId) : billingService.getPlan('free');

    return res.json({
      success: true,
      data: {
        subscription,
        plan
      }
    });
  } catch (error: any) {
    logger.error('Get subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /billing/history - Get billing history
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { limit = '20' } = req.query;
    
    const history = await billingService.getBillingHistory(
      req.user.uid,
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: { history }
    });
  } catch (error: any) {
    logger.error('Get billing history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /billing/create-payment-intent - Create payment intent for one-time payments
 */
router.post('/create-payment-intent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { planId, currency = 'brl' } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const plan = billingService.getPlan(planId);
    if (!plan || plan.id === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Create customer if needed
    const customer = await billingService.createCustomer(
      req.user.uid,
      req.user.email || ''
    );

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(plan.price * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customer.stripeCustomerId,
      metadata: {
        userId: req.user.uid,
        planId
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    return res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: plan.price,
        currency: plan.currency
      }
    });
  } catch (error: any) {
    logger.error('Create payment intent error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /billing/crypto/create-payment - Create crypto payment
 */
router.post('/crypto/create-payment', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { planId, currency } = req.body;
    
    if (!planId || !currency) {
      return res.status(400).json({ error: 'Plan ID and currency are required' });
    }

    if (!['USDT', 'USDC'].includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency. Only USDT and USDC are supported' });
    }

    const payment = await billingService.createCryptoPayment(
      req.user.uid,
      planId,
      currency
    );

    return res.json({
      success: true,
      data: payment
    });
  } catch (error: any) {
    logger.error('Create crypto payment error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /billing/crypto/payment/:paymentId - Get crypto payment status
 */
router.get('/crypto/payment/:paymentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { paymentId } = req.params;
    
    const paymentDoc = await db.collection('crypto_payments').doc(paymentId).get();
    
    if (!paymentDoc.exists) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const paymentData = paymentDoc.data();
    
    // Check if user owns this payment
    if (paymentData?.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      success: true,
      data: paymentData
    });
  } catch (error: any) {
    logger.error('Get crypto payment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /billing/portal - Create customer portal session
 */
router.post('/portal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { returnUrl } = req.body;
    
    // Get customer
    const customer = await billingService.createCustomer(
      req.user.uid,
      req.user.email || ''
    );

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/dashboard/billing`
    });

    return res.json({
      success: true,
      data: {
        url: session.url
      }
    });
  } catch (error: any) {
    logger.error('Create portal session error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /billing/webhook - Handle Stripe webhooks
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe signature' });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    await billingService.handleWebhook(event);

    return res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /billing/usage - Get current billing period usage
 */
router.get('/usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get current subscription
    const subscription = await billingService.getUserSubscription(req.user.uid);
    const plan = subscription ? billingService.getPlan(subscription.planId) : billingService.getPlan('free');

    // Get AI usage stats
    const currentMonth = new Date().toISOString().substring(0, 7);
    const usageDoc = await db.collection('users').doc(req.user.uid).collection('ai_usage').doc(currentMonth).get();
    const usage = usageDoc.exists ? usageDoc.data() : {
      individual_trade: 0,
      daily_report: 0,
      weekly_report: 0,
      pattern_analysis: 0,
      totalCost: 0,
      totalTokens: 0
    };

    return res.json({
      success: true,
      data: {
        subscription: subscription || { planId: 'free', status: 'active' },
        plan,
        usage,
        limits: plan?.aiLimits || {
          individual_trade: 5,
          daily_report: 0,
          weekly_report: 0,
          pattern_analysis: 0
        }
      }
    });
  } catch (error: any) {
    logger.error('Get usage error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;