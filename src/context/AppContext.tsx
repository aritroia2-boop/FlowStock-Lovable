import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../lib/auth';
import { subscriptionService, hasFeatureAccess } from '../lib/subscriptionService';

type Page = 'login' | 'signup' | 'dashboard' | 'inventory' | 'recipes' | 'audit-logs' | 'settings' | 'orders' | 'pricing';
type InventoryFilter = 'All' | 'Low Stock' | 'In Stock';

interface AppContextType {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  inventoryFilter: InventoryFilter;
  setInventoryFilter: (filter: InventoryFilter) => void;
  connectionError: string | null;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  hasFeature: (feature: string) => boolean;
  checkSubscription: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('All');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'enterprise'>('free');

  const isAuthenticated = currentUser !== null;

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
      if (user) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    const timeout = setTimeout(() => {
      console.warn('Session check is taking too long, defaulting to login page');
      setIsLoading(false);
      setCurrentPage('login');
    }, 5000);

    try {
      const session = await authService.getSession();
      clearTimeout(timeout);

      if (session) {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('login');
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error checking session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        setConnectionError('Unable to connect to database. Please check your connection.');
      }
      setCurrentPage('login');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSubscription = async () => {
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscriptionTier(status.tier);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const hasFeature = (feature: string) => {
    return hasFeatureAccess(subscriptionTier, feature);
  };

  useEffect(() => {
    if (currentUser) {
      checkSubscription();
    }
  }, [currentUser]);

  const logout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
      setSubscriptionTier('free');
      setCurrentPage('login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AppContext.Provider value={{ 
      currentPage, 
      setCurrentPage, 
      currentUser, 
      setCurrentUser, 
      isAuthenticated, 
      isLoading, 
      logout, 
      inventoryFilter, 
      setInventoryFilter, 
      connectionError,
      subscriptionTier,
      hasFeature,
      checkSubscription
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const useAppContext = useApp;
