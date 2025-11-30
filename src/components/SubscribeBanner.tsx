import { Crown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const SubscribeBanner = () => {
  const { setCurrentPage, canAccessRestaurantFeatures } = useAppContext();

  if (canAccessRestaurantFeatures) return null;

  return (
    <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-b border-primary/20 p-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Unlock Full Access</h3>
            <p className="text-sm text-muted-foreground">
              Subscribe to access restaurant features, inventory, recipes, and more!
            </p>
          </div>
        </div>
        <button
          onClick={() => setCurrentPage('pricing')}
          className="flex-shrink-0 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
        >
          Subscribe Now
        </button>
      </div>
    </div>
  );
};
