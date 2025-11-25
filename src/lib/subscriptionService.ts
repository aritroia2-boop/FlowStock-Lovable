import { supabase } from './supabase';

export interface SubscriptionStatus {
  status: 'none' | 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  tier: 'free' | 'pro' | 'enterprise';
  expires: string | null;
  cancelAtPeriodEnd?: boolean;
}

export const subscriptionService = {
  async createCheckoutSession(priceId: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('create-checkout-session', {
      body: { priceId },
    });

    if (response.error) throw response.error;
    return response.data.url;
  },

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { status: 'none', tier: 'free', expires: null };
    }

    const response = await supabase.functions.invoke('get-subscription-status', {
      body: {},
    });

    if (response.error) throw response.error;
    return response.data;
  },

  async cancelSubscription(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('cancel-subscription', {
      body: {},
    });

    if (response.error) throw response.error;
  },
};

// Feature access helper
export const hasFeatureAccess = (tier: string, feature: string): boolean => {
  const features = {
    free: ['basic_inventory', 'basic_recipes'],
    pro: ['basic_inventory', 'basic_recipes', 'ai_invoice', 'teams', 'analytics'],
    enterprise: ['basic_inventory', 'basic_recipes', 'ai_invoice', 'teams', 'analytics', 'priority_support', 'custom_integrations'],
  };

  return features[tier as keyof typeof features]?.includes(feature) ?? false;
};

// Plan configuration
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'forever',
    available: true,
    features: [
      'Up to 50 ingredients',
      'Up to 10 recipes',
      'Basic inventory tracking',
      'Manual order entry',
    ],
    cta: 'Current Plan'
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€29',
    period: 'per month',
    available: true,
    priceId: 'price_xxxxxxxxxxxxx', // Replace with your actual Stripe price ID
    features: [
      'Unlimited ingredients',
      'Unlimited recipes',
      'AI-powered invoice processing',
      'Team management (up to 10 users)',
      'Weekly analytics',
      'Priority email support',
    ],
    cta: 'Subscribe to Pro',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '€99',
    period: 'per month',
    available: true,
    priceId: 'price_xxxxxxxxxxxxx', // Replace with your actual Stripe price ID
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Advanced analytics & insights',
      'Custom integrations',
      'Dedicated account manager',
      'Phone support',
    ],
    cta: 'Subscribe to Enterprise',
  },
];
