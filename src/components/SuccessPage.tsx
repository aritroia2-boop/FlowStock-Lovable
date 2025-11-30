import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { subscriptionService } from '../lib/subscriptionService';
import { toast } from 'sonner';
import { authService } from '../lib/auth';

export const SuccessPage = () => {
  const { setCurrentPage, setCurrentUser } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    // Refresh user data to get updated subscription status
    const refreshUser = async () => {
      try {
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error refreshing user:', error);
      } finally {
        setRefreshing(false);
      }
    };

    refreshUser();
  }, [setCurrentUser]);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const url = await subscriptionService.openCustomerPortal();
      window.open(url, '_blank');
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Subscription Active!
          </h1>
          
          <p className="text-muted-foreground mb-8">
            {refreshing 
              ? 'Activating your subscription...' 
              : 'Welcome to FlowStock Pro! You now have full access to all features.'}
          </p>

          {refreshing ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Dashboard
              </button>
              
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
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
        </div>
      </div>
    </div>
  );
};
