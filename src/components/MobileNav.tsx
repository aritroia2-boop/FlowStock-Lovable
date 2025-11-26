import { LayoutDashboard, Package, ChefHat, ShoppingCart, Settings } from 'lucide-react';
import { NavLink } from './NavLink';
import { useApp } from '@/context/AppContext';

export const MobileNav = () => {
  const { currentPage } = useApp();

  const navItems = [
    { page: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
    { page: 'inventory' as const, icon: Package, label: 'Inventory' },
    { page: 'recipes' as const, icon: ChefHat, label: 'Recipes' },
    { page: 'orders' as const, icon: ShoppingCart, label: 'Orders' },
    { page: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 md:hidden safe-area-bottom">
      <div className="flex justify-around items-center px-2 py-2">
        {navItems.map(({ page, icon: Icon, label }) => (
          <NavLink
            key={page}
            to={page}
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 rounded-xl transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            activeClassName="text-primary bg-primary/10"
          >
            <Icon size={20} className="mb-1" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
