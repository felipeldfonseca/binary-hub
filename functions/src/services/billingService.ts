import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import Stripe from 'stripe';

const db = getFirestore();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: 'BRL' | 'USD';
  interval: 'month' | 'year';
  features: string[];
  aiLimits: {
    individual_trade: number;
    daily_report: number;
    weekly_report: number;
    pattern_analysis: number;
  };
  stripePriceId: string;
  cryptoPrice?: {
    usdt: number;
    usdc: number;
  };
}

export interface BillingCustomer {
  id: string;
  userId: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  defaultPaymentMethod?: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  taxInfo?: {
    cpf?: string; // Brazilian CPF
    cnpj?: string; // Brazilian CNPJ
    vatId?: string; // International VAT ID
  };
}

export interface Subscription {
  id: string;
  userId: string;
  customerId: string;
  stripeSubscriptionId: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod: 'stripe' | 'crypto';
  cryptoPayment?: {
    currency: 'USDT' | 'USDC';
    amount: number;
    address: string;
    transactionHash?: string;
  };
}

export class BillingService {
  // Subscription plans for Brazilian market
  private readonly PLANS: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      currency: 'BRL',
      interval: 'month',
      features: [
        'Diário de trading básico',
        '5 análises AI por mês',
        'Perfil social básico',
        'Suporte por email'
      ],
      aiLimits: {
        individual_trade: 5,
        daily_report: 0,
        weekly_report: 0,
        pattern_analysis: 0
      },
      stripePriceId: ''
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 97.00,
      currency: 'BRL',
      interval: 'month',
      features: [
        'Diário de trading avançado',
        '100 análises AI individuais/mês',
        '30 relatórios diários AI/mês',
        '4 relatórios semanais AI/mês',
        '10 análises de padrões/mês',
        'Perfil social completo',
        'Analytics avançados',
        'Suporte prioritário'
      ],
      aiLimits: {
        individual_trade: 100,
        daily_report: 30,
        weekly_report: 4,
        pattern_analysis: 10
      },
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
      cryptoPrice: {
        usdt: 19,
        usdc: 19
      }
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 147.00,
      currency: 'BRL',
      interval: 'month',
      features: [
        'Tudo do Pro +',
        '500 análises AI individuais/mês',
        '100 relatórios diários AI/mês',
        '20 relatórios semanais AI/mês',
        '50 análises de padrões/mês',
        'Análises AI ilimitadas (fair use)',
        'Recursos de colaboração',
        'API access',
        'Suporte 24/7'
      ],
      aiLimits: {
        individual_trade: 500,
        daily_report: 100,
        weekly_report: 20,
        pattern_analysis: 50
      },
      stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
      cryptoPrice: {
        usdt: 29,
        usdc: 29
      }
    }
  ];

  /**
   * Create or get Stripe customer for user
   */
  async createCustomer(userId: string, email: string, name?: string): Promise<BillingCustomer> {
    try {
      // Check if customer already exists
      const existingCustomerDoc = await db.collection('billing_customers').where('userId', '==', userId).get();
      
      if (!existingCustomerDoc.empty) {
        const existingData = existingCustomerDoc.docs[0].data() as BillingCustomer;
        return existingData;
      }

      // Create new Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId
        }
      });

      const billingCustomer: BillingCustomer = {
        id: stripeCustomer.id,
        userId,
        stripeCustomerId: stripeCustomer.id,
        email,
        name
      };

      // Store in Firestore
      await db.collection('billing_customers').doc(stripeCustomer.id).set({
        ...billingCustomer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return billingCustomer;
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  /**
   * Create subscription with Stripe
   */
  async createSubscription(
    userId: string, 
    planId: string, 
    paymentMethodId?: string
  ): Promise<{ clientSecret?: string; subscriptionId: string }> {
    try {
      const plan = this.PLANS.find(p => p.id === planId);
      if (!plan || plan.id === 'free') {
        throw new Error('Invalid plan');
      }

      // Get or create customer
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const customer = await this.createCustomer(userId, userData?.email, userData?.displayName);

      // Create Stripe subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.stripeCustomerId,
        items: [{
          price: plan.stripePriceId
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          planId
        }
      };

      if (paymentMethodId) {
        subscriptionParams.default_payment_method = paymentMethodId;
      }

      const stripeSubscription = await stripe.subscriptions.create(subscriptionParams);

      // Store subscription in Firestore
      const subscription: Subscription = {
        id: stripeSubscription.id,
        userId,
        customerId: customer.id,
        stripeSubscriptionId: stripeSubscription.id,
        planId,
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paymentMethod: 'stripe'
      };

      await db.collection('subscriptions').doc(stripeSubscription.id).set(subscription);

      // Update user subscription info
      await db.collection('users').doc(userId).update({
        'subscription.tier': planId,
        'subscription.status': stripeSubscription.status,
        'subscription.stripeSubscriptionId': stripeSubscription.id,
        'subscription.currentPeriodEnd': subscription.currentPeriodEnd,
        'subscription.updatedAt': new Date().toISOString()
      });

      // Extract client secret for payment confirmation
      const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;

      return {
        subscriptionId: stripeSubscription.id,
        clientSecret: paymentIntent?.client_secret
      };
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
    try {
      // Verify user owns this subscription
      const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();
      if (!subscriptionDoc.exists) {
        throw new Error('Subscription not found');
      }

      const subscriptionData = subscriptionDoc.data() as Subscription;
      if (subscriptionData.userId !== userId) {
        throw new Error('Unauthorized');
      }

      // Cancel in Stripe
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      // Update in Firestore
      await db.collection('subscriptions').doc(subscriptionId).update({
        status: 'canceled',
        updatedAt: new Date().toISOString()
      });

      // Update user subscription info to revert to free after period ends
      await db.collection('users').doc(userId).update({
        'subscription.status': 'canceled',
        'subscription.updatedAt': new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(userId: string, subscriptionId: string, newPlanId: string): Promise<void> {
    try {
      const newPlan = this.PLANS.find(p => p.id === newPlanId);
      if (!newPlan || newPlan.id === 'free') {
        throw new Error('Invalid plan');
      }

      // Verify user owns this subscription
      const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();
      if (!subscriptionDoc.exists) {
        throw new Error('Subscription not found');
      }

      const subscriptionData = subscriptionDoc.data() as Subscription;
      if (subscriptionData.userId !== userId) {
        throw new Error('Unauthorized');
      }

      // Get current Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Update subscription in Stripe
      await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripePriceId
        }],
        proration_behavior: 'create_prorations'
      });

      // Update in Firestore
      await db.collection('subscriptions').doc(subscriptionId).update({
        planId: newPlanId,
        updatedAt: new Date().toISOString()
      });

      // Update user subscription info
      await db.collection('users').doc(userId).update({
        'subscription.tier': newPlanId,
        'subscription.updatedAt': new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw new Error('Failed to update subscription');
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const subscriptionSnapshot = await db.collection('subscriptions')
        .where('userId', '==', userId)
        .where('status', 'in', ['active', 'trialing', 'past_due'])
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (subscriptionSnapshot.empty) {
        return null;
      }

      return subscriptionSnapshot.docs[0].data() as Subscription;
    } catch (error) {
      logger.error('Error getting user subscription:', error);
      return null;
    }
  }

  /**
   * Get user's billing history
   */
  async getBillingHistory(userId: string, limit = 20): Promise<any[]> {
    try {
      const customer = await this.getCustomerByUserId(userId);
      if (!customer) {
        return [];
      }

      const invoices = await stripe.invoices.list({
        customer: customer.stripeCustomerId,
        limit,
        expand: ['data.payment_intent']
      });

      return invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        created: new Date(invoice.created * 1000).toISOString(),
        invoiceUrl: invoice.hosted_invoice_url,
        description: invoice.lines.data[0]?.description || 'Subscription',
        period: {
          start: new Date(invoice.period_start * 1000).toISOString(),
          end: new Date(invoice.period_end * 1000).toISOString()
        }
      }));
    } catch (error) {
      logger.error('Error getting billing history:', error);
      return [];
    }
  }

  /**
   * Create crypto payment record
   */
  async createCryptoPayment(
    userId: string, 
    planId: string, 
    currency: 'USDT' | 'USDC'
  ): Promise<{ paymentId: string; amount: number; address: string }> {
    try {
      const plan = this.PLANS.find(p => p.id === planId);
      if (!plan || !plan.cryptoPrice) {
        throw new Error('Invalid plan or crypto not supported');
      }

      const amount = plan.cryptoPrice[currency.toLowerCase() as keyof typeof plan.cryptoPrice];
      
      // Generate payment address (in production, this would be from your crypto processor)
      const paymentAddress = this.generateCryptoAddress(currency);
      
      const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Store payment record
      await db.collection('crypto_payments').doc(paymentId).set({
        id: paymentId,
        userId,
        planId,
        currency,
        amount,
        address: paymentAddress,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      });

      return {
        paymentId,
        amount,
        address: paymentAddress
      };
    } catch (error) {
      logger.error('Error creating crypto payment:', error);
      throw new Error('Failed to create crypto payment');
    }
  }

  /**
   * Get available plans
   */
  getPlans(): SubscriptionPlan[] {
    return this.PLANS;
  }

  /**
   * Get plan by ID
   */
  getPlan(planId: string): SubscriptionPlan | undefined {
    return this.PLANS.find(p => p.id === planId);
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getCustomerByUserId(userId: string): Promise<BillingCustomer | null> {
    try {
      const customerSnapshot = await db.collection('billing_customers')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (customerSnapshot.empty) {
        return null;
      }

      return customerSnapshot.docs[0].data() as BillingCustomer;
    } catch (error) {
      logger.error('Error getting customer by user ID:', error);
      return null;
    }
  }

  private generateCryptoAddress(currency: 'USDT' | 'USDC'): string {
    // In production, this would integrate with your crypto payment processor
    // For now, return a mock address
    const mockAddresses = {
      USDT: '0x742d35Cc7Bf4C93b6Bfb2F5b8a2e2f5B8A2E2F5B',
      USDC: '0x852d35Cc7Bf4C93b6Bfb2F5b8a2e2f5B8A2E2F5C'
    };
    return mockAddresses[currency];
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.userId;
      if (!userId) return;

      // Update subscription in Firestore
      await db.collection('subscriptions').doc(subscription.id).update({
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Update user subscription info
      const planId = subscription.status === 'canceled' ? 'free' : subscription.metadata.planId || 'free';
      await db.collection('users').doc(userId).update({
        'subscription.tier': planId,
        'subscription.status': subscription.status,
        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000).toISOString(),
        'subscription.updatedAt': new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error handling subscription change:', error);
    }
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscription = invoice.subscription as string;
      if (!subscription) return;

      // Log successful payment
      logger.info(`Payment succeeded for subscription: ${subscription}`);
      
      // Could send confirmation email or update analytics here
    } catch (error) {
      logger.error('Error handling payment success:', error);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscription = invoice.subscription as string;
      if (!subscription) return;

      // Log failed payment
      logger.warn(`Payment failed for subscription: ${subscription}`);
      
      // Could send notification email or update user status here
    } catch (error) {
      logger.error('Error handling payment failure:', error);
    }
  }
}

export default new BillingService();