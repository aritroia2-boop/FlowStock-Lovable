import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

/**
 * Hook to protect pages from users with no access at all.
 * Allows: admins, self-subscribed users, AND employees inheriting access from their restaurant.
 * Personal-only feature gating happens inside each page (see PersonalPaywall).
 */
export const useSubscriptionGuard = () => {
  const { currentUser, setCurrentPage } = useAppContext();

  useEffect(() => {
    if (!currentUser) return;

    const subscriptionSource = currentUser.subscription_source || 'none';
    const hasAccess =
      currentUser.is_subscribed ||
      currentUser.is_admin ||
      subscriptionSource !== 'none';

    if (!hasAccess) {
      console.log('[SUBSCRIPTION GUARD] No access, redirecting to pricing');
      setCurrentPage('pricing');
    }
  }, [currentUser, setCurrentPage]);
};
