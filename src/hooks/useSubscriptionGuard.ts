import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

/**
 * Hook to protect restaurant features from non-subscribed, non-admin users
 * Redirects to pricing page if user doesn't have access
 */
export const useSubscriptionGuard = () => {
  const { currentUser, setCurrentPage } = useAppContext();

  useEffect(() => {
    if (!currentUser) return;

    // Allow access if subscribed OR admin
    const hasAccess = currentUser.is_subscribed || currentUser.is_admin;
    
    if (!hasAccess) {
      console.log('[SUBSCRIPTION GUARD] Access denied, redirecting to pricing');
      setCurrentPage('pricing');
    }
  }, [currentUser, setCurrentPage]);
};
