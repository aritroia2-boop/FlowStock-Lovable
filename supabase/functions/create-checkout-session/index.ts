import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user?.email) throw new Error('User not authenticated or email not available');

    const { priceId, successUrl, cancelUrl } = await req.json();
    if (!priceId) throw new Error('Price ID is required');

    const origin = req.headers.get('origin') || 'http://localhost:5173';

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, name')
      .eq('id', user.id)
      .single();

    // Check for existing subscription
    let customerId: string | undefined;
    const { data: existingSubscription } = await supabaseClient
      .from('subscriptions')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSubscription?.customer_id) {
      customerId = existingSubscription.customer_id;
    } else {
      // Create or retrieve Stripe customer
      const customers = await stripe.customers.list({
        email: profile?.email || user.email!,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: profile?.email || user.email!,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${origin}/settings?subscription=success`,
      cancel_url: cancelUrl || `${origin}/pricing`,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
