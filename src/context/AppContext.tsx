import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../lib/auth';

type Page = 'login' | 'signup' | 'dashboard' | 'inventory' | 'recipes' | 'audit-logs' | 'settings' | 'orders' | 'pricing' | 'success' | 'cancel';
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
  isSubscribed: boolean;
  isAdmin: boolean;
  canAccessRestaurantFeatures: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('All');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const isAuthenticated = currentUser !== null;
  const isSubscribed = currentUser?.is_subscribed || false;
  const isAdmin = currentUser?.is_admin || false;
  const canAccessRestaurantFeatures = isSubscribed || isAdmin;

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

  const logout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
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
      isSubscribed,
      isAdmin,
      canAccessRestaurantFeatures
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
