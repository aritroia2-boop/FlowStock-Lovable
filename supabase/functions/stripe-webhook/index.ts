import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.14.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEBHOOK ${new Date().toISOString()}] ${step}${detailsStr}`);
};

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    logStep('ERROR: Missing signature or secret');
    return new Response('Missing signature or secret', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    logStep('Event received', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        
        if (!userId) {
          logStep('ERROR: No userId in session metadata');
          break;
        }
        
        logStep('Processing checkout.session.completed', { userId, sessionId: session.id });
        
        // Idempotency check
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('stripe_subscription_id')
          .eq('id', userId)
          .single();
        
        if (existingProfile?.stripe_subscription_id === session.subscription) {
          logStep('IDEMPOTENT: Subscription already processed', { subscriptionId: session.subscription });
          return new Response(JSON.stringify({ received: true, idempotent: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        
        // Retrieve full subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        logStep('Subscription retrieved', { subscriptionId: subscription.id, status: subscription.status });
        
        // Update profiles table with subscription data
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status: 'active',
            subscription_tier: 'pro',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (profileError) {
          logStep('ERROR: Failed to update profile', { error: profileError });
          throw profileError;
        }
        
        // Upsert to subscriptions table for detailed tracking
        const { error: subscriptionError } = await supabase.from('subscriptions').upsert({
          id: subscription.id,
          user_id: userId,
          customer_id: subscription.customer as string,
          status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        });
        
        if (subscriptionError) {
          logStep('ERROR: Failed to upsert subscription', { error: subscriptionError });
          throw subscriptionError;
        }
        
        logStep('✅ User subscribed successfully', { userId, subscriptionId: subscription.id });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let userId = subscription.metadata?.userId;
        
        // Fallback: find user by subscription ID
        if (!userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          
          if (!profile) {
            logStep('ERROR: Cannot find user for canceled subscription', { subscriptionId: subscription.id });
            break;
          }
          userId = profile.id;
        }
        
        logStep('Processing customer.subscription.deleted', { userId, subscriptionId: subscription.id });
        
        // Idempotency check
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', userId)
          .single();
        
        if (existingProfile?.subscription_status === 'canceled') {
          logStep('IDEMPOTENT: Subscription already canceled', { subscriptionId: subscription.id });
          return new Response(JSON.stringify({ received: true, idempotent: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        
        // Update profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_status: 'canceled',
            subscription_tier: 'free',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (profileError) {
          logStep('ERROR: Failed to update profile on cancellation', { error: profileError });
          throw profileError;
        }
        
        // Update subscriptions table
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', subscription.id);
        
        if (subscriptionError) {
          logStep('ERROR: Failed to update subscription record', { error: subscriptionError });
        }
        
        logStep('❌ User subscription canceled', { userId, subscriptionId: subscription.id });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        let userId = subscription.metadata?.userId;
        
        if (!userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          
          if (!profile) {
            logStep('WARNING: Cannot find user for updated subscription', { subscriptionId: subscription.id });
            break;
          }
          userId = profile.id;
        }
        
        logStep('Processing customer.subscription.updated', { userId, subscriptionId: subscription.id, status: subscription.status });
        
        const isActive = ['active', 'trialing'].includes(subscription.status);
        
        // Update profiles
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_subscribed: isActive,
            subscription_status: subscription.status,
            subscription_tier: isActive ? 'pro' : 'free',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (profileError) {
          logStep('ERROR: Failed to update profile on subscription update', { error: profileError });
          throw profileError;
        }
        
        // Upsert subscription record
        const { error: subscriptionError } = await supabase.from('subscriptions').upsert({
          id: subscription.id,
          user_id: userId,
          customer_id: subscription.customer as string,
          status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        });
        
        if (subscriptionError) {
          logStep('ERROR: Failed to upsert subscription on update', { error: subscriptionError });
        }
        
        logStep('🔄 User subscription updated', { userId, subscriptionId: subscription.id, status: subscription.status });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          logStep('Processing invoice.payment_failed', { subscriptionId });
          
          const { error } = await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', subscriptionId);
          
          if (error) {
            logStep('ERROR: Failed to update subscription to past_due', { error });
          } else {
            logStep('⚠️ Subscription marked as past_due', { subscriptionId });
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    logStep('FATAL ERROR in webhook handler', { error: error instanceof Error ? error.message : String(error) });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
