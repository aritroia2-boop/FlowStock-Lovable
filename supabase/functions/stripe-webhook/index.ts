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

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or secret', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

        // Determine tier based on price - You'll need to map your actual price IDs here
        let tier = 'free';
        const priceId = subscription.items.data[0]?.price.id;
        
        // Example mapping - replace with your actual price IDs
        if (priceId?.includes('pro') || priceId === 'price_pro') {
          tier = 'pro';
        } else if (priceId?.includes('enterprise') || priceId === 'price_enterprise') {
          tier = 'enterprise';
        }

        // Upsert subscription
        await supabase.from('subscriptions').upsert({
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

        // Update profile tier
        await supabase
          .from('profiles')
          .update({ subscription_tier: tier })
          .eq('id', userId);

        console.log(`Subscription ${subscription.id} upserted for user ${userId} with tier ${tier}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

        // Mark as canceled
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', subscription.id);

        // Downgrade to free
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', userId);

        console.log(`Subscription ${subscription.id} canceled for user ${userId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', subscriptionId);

          console.log(`Subscription ${subscriptionId} marked as past_due`);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
