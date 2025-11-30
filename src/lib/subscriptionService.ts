import { supabase } from './supabase';

export const SUBSCRIPTION_PRICE_ID = 'price_1SYzmMPTY1BjOCKcgTX09rOi';
export const SUBSCRIPTION_PRICE = '178.99 RON';

export const subscriptionService = {
  async createCheckoutSession(successUrl?: string, cancelUrl?: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('create-checkout-session', {
      body: { 
        successUrl,
        cancelUrl
      },
    });

    if (response.error) throw response.error;
    return response.data.url;
  },

  async openCustomerPortal(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('customer-portal', {
      body: {},
    });

    if (response.error) throw response.error;
    return response.data.url;
  },
};
