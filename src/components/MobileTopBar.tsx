import { Menu } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { LayoutDashboard, Package, ChefHat, ShoppingCart, FileText, Settings, LogOut } from 'lucide-react';
import { NavLink } from './NavLink';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  recipes: 'Recipes',
  orders: 'Orders',
  'audit-logs': 'Audit Logs',
  settings: 'Settings',
  pricing: 'Pricing',
  success: 'Success',
  cancel: 'Cancel',
};

export const MobileTopBar = () => {
  const { currentPage, currentUser, logout } = useApp();
  const [open, setOpen] = useState(false);

  const navItems = [
    { page: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
    { page: 'inventory' as const, icon: Package, label: 'Inventory' },
    { page: 'recipes' as const, icon: ChefHat, label: 'Recipes' },
    { page: 'orders' as const, icon: ShoppingCart, label: 'Orders' },
    { page: 'audit-logs' as const, icon: FileText, label: 'Audit Logs' },
    { page: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <header className="md:hidden sticky top-0 z-40 h-14 bg-card/90 backdrop-blur-xl border-b border-border flex items-center px-3 gap-2 pt-[env(safe-area-inset-top)]">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
            <Menu size={22} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex flex-col h-full">
            <div className="px-5 py-6 border-b border-border">
              <h1 className="text-xl font-bold text-primary">FlowStock</h1>
              {currentUser && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{currentUser.email}</p>
              )}
            </div>
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {navItems.map(({ page, icon: Icon, label }) => (
                <NavLink
                  key={page}
                  to={page}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  activeClassName="bg-primary text-primary-foreground font-medium"
                  onClick={() => setOpen(false)}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-border">
              <Button
                onClick={() => { logout(); setOpen(false); }}
                variant="outline"
                className="w-full justify-start gap-3 h-11"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <h2 className="flex-1 text-base font-semibold text-foreground truncate text-center">
        {PAGE_TITLES[currentPage] || 'FlowStock'}
      </h2>

      <div className="w-10" />
    </header>
  );
};
