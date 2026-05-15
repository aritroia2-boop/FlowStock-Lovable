import { LayoutDashboard, Package, ChefHat, ShoppingCart, Settings } from 'lucide-react';
import { NavLink } from './NavLink';

export const MobileNav = () => {
  const navItems = [
    { page: 'dashboard' as const, icon: LayoutDashboard, label: 'Home' },
    { page: 'inventory' as const, icon: Package, label: 'Stock' },
    { page: 'recipes' as const, icon: ChefHat, label: 'Recipes' },
    { page: 'orders' as const, icon: ShoppingCart, label: 'Orders' },
    { page: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center px-1 py-1.5">
        {navItems.map(({ page, icon: Icon, label }) => (
          <NavLink
            key={page}
            to={page}
            className="flex flex-col items-center justify-center flex-1 min-h-[52px] gap-0.5 rounded-xl transition-colors text-muted-foreground hover:text-foreground active:bg-accent"
            activeClassName="text-primary"
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
