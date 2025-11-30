import { useState } from 'react';
import { Check, ArrowLeft, Loader2, Shield, CreditCard } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { subscriptionService, SUBSCRIPTION_PRICE_ID, SUBSCRIPTION_PRICE } from '../lib/subscriptionService';
import { toast } from 'sonner';

export const PricingPage = () => {
  const { setCurrentPage, currentUser, isSubscribed, isAdmin, canAccessRestaurantFeatures } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!currentUser) {
      toast.error('Please log in to subscribe');
      setCurrentPage('login');
      return;
    }

    setLoading(true);
    try {
      const origin = window.location.origin;
      const url = await subscriptionService.createCheckoutSession(
        `${origin}/success`,
        `${origin}/cancel`
      );
      window.location.href = url; // Full page redirect to Stripe Checkout
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const url = await subscriptionService.openCustomerPortal();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  // If user already has access, show subscription active view
  if (canAccessRestaurantFeatures) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <div className="bg-card/50 border-b border-border/40 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="p-2 hover:bg-accent/50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Subscription</h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {isAdmin ? 'Admin Access Active' : 'Subscription Active'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isAdmin 
                ? 'You have admin access to all restaurant features.' 
                : 'You have full access to all restaurant features.'}
            </p>
            
            {isSubscribed && !isAdmin && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="font-medium text-foreground">FlowStock Pro</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="font-medium text-foreground">{SUBSCRIPTION_PRICE}/month</span>
                  </div>
                </div>
                
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Manage Billing
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              onClick={() => setCurrentPage('dashboard')}
              className="mt-6 text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show pricing card for non-subscribed users
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
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Subscribe to FlowStock</h1>
        </div>
      </div>

      {/* Pricing Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-3 sm:mb-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full">
            <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">Simple, Transparent Pricing</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4 px-4">
            Unlock full restaurant features
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-4">
            One simple plan with everything you need
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="relative bg-card rounded-xl sm:rounded-2xl shadow-lg border-2 border-primary">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                Recommended
              </span>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">FlowStock Pro</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">{SUBSCRIPTION_PRICE}</span>
                  <span className="text-sm sm:text-base text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Unlimited ingredients & recipes</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">AI-powered invoice processing</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Order management</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Team collaboration</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">Audit logs & analytics</span>
                </li>
              </ul>

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-3 rounded-lg font-medium transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Subscribe Now'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Cancel anytime • No hidden fees • Secure payment
          </p>
        </div>
      </div>
    </div>
  );
};
