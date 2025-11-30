import { XCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const CancelPage = () => {
  const { setCurrentPage } = useAppContext();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Checkout Canceled
          </h1>
          
          <p className="text-muted-foreground mb-8">
            No worries! You can subscribe anytime to unlock all restaurant features.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setCurrentPage('pricing')}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="w-full px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
