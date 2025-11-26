import { useState, useEffect } from 'react';
import { Check, ArrowLeft, Loader2, Shield } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { subscriptionService, PLANS } from '../lib/subscriptionService';
import { toast } from 'sonner';

export const PricingPage = () => {
  const { setCurrentPage, currentUser, subscriptionTier } = useAppContext();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, tier: string) => {
    if (!currentUser) {
      toast.error('Please log in to subscribe');
      setCurrentPage('login');
      return;
    }

    setLoading(tier);
    try {
      const url = await subscriptionService.createCheckoutSession(priceId);
      window.open(url, '_blank');
      toast.success('Opening checkout...');
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  const isCurrentPlan = (planId: string) => {
    return subscriptionTier === planId;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20 md:pb-0">
      {/* Header */}
      <div className="bg-card/50 border-b border-border/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="p-2 hover:bg-accent/50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Choose Your Plan</h1>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full">
            <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">Simple, Transparent Pricing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4 px-4">
            Choose the plan that's right for your restaurant
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-4">
            Start free, upgrade as you grow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card rounded-xl sm:rounded-2xl shadow-lg border-2 transition-all ${
                plan.popular
                  ? 'border-primary md:scale-105'
                  : 'border-border/40 hover:border-border'
              } ${isCurrentPlan(plan.id) ? 'ring-2 ring-primary/50' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrentPlan(plan.id) && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Your Plan
                  </span>
                </div>
              )}

              <div className="p-6 sm:p-8">
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm sm:text-base text-muted-foreground">/{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => plan.priceId && handleSubscribe(plan.priceId, plan.id)}
                  disabled={isCurrentPlan(plan.id) || loading === plan.id || !plan.priceId}
                  className={`w-full py-3 rounded-lg font-medium transition-all ${
                    isCurrentPlan(plan.id)
                      ? 'bg-muted text-muted-foreground cursor-default'
                      : plan.popular
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                  } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan(plan.id) ? (
                    'Current Plan'
                  ) : (
                    plan.cta
                  )}
                </button>

                {!plan.priceId && plan.id !== 'free' && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Configure your Stripe price ID in subscriptionService.ts
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            All plans include 14-day money-back guarantee • Cancel anytime • No hidden fees
          </p>
          <p className="text-xs text-muted-foreground">
            Need help choosing? Contact us at support@flowstock.com
          </p>
        </div>
      </div>
    </div>
  );
};
