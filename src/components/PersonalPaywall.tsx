import { Lock, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface PersonalPaywallProps {
  feature?: string;
}

export const PersonalPaywall = ({ feature = 'Personal' }: PersonalPaywallProps) => {
  const { setCurrentPage } = useAppContext();

  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border-2 border-dashed border-primary/30 p-10 text-center shadow-lg">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30">
        <Lock size={28} className="text-white" />
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-2">
        {feature} features require Pro
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Your restaurant subscription gives you full access to <strong>Restaurant</strong> features.
        To use your own private {feature.toLowerCase()} workspace, upgrade to Pro for your account.
      </p>
      <button
        onClick={() => setCurrentPage('pricing')}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all"
      >
        <Sparkles size={18} />
        Upgrade to Pro
      </button>
    </div>
  );
};
