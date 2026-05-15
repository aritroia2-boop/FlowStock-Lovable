import { LayoutDashboard, Package, ChefHat, ShoppingCart, FileText, Settings, LogOut, Menu } from 'lucide-react';
import { NavLink } from './NavLink';
import { useApp } from '@/context/AppContext';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { useState } from 'react';

export const ResponsiveSidebar = () => {
  const { logout, currentUser } = useApp();
  const [open, setOpen] = useState(false);

  const navItems = [
    { page: 'dashboard' as const, icon: LayoutDashboard, label: 'Dashboard' },
    { page: 'inventory' as const, icon: Package, label: 'Inventory' },
    { page: 'recipes' as const, icon: ChefHat, label: 'Recipes' },
    { page: 'orders' as const, icon: ShoppingCart, label: 'Orders' },
    { page: 'audit-logs' as const, icon: FileText, label: 'Audit Logs' },
    { page: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  const SidebarContent = () => (
    <>
      <div className="px-4 py-6">
        <h1 className="text-xl font-bold text-primary">FlowStock</h1>
        {currentUser && (
          <p className="text-xs text-muted-foreground mt-1">{currentUser.email}</p>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ page, icon: Icon, label }) => (
          <NavLink
            key={page}
            to={page}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            activeClassName="bg-primary text-primary-foreground font-medium"
            onClick={() => setOpen(false)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <Button
          onClick={() => {
            logout();
            setOpen(false);
          }}
          variant="outline"
          className="w-full justify-start gap-3"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer is rendered by MobileTopBar */}
    </>
  );
};
