import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";

type Page = 'login' | 'signup' | 'dashboard' | 'inventory' | 'recipes' | 'audit-logs' | 'settings' | 'orders' | 'pricing';

interface NavLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  to: Page;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}

const NavLink = forwardRef<HTMLButtonElement, NavLinkProps>(
  ({ className, activeClassName, to, children, onClick, ...props }, ref) => {
    const { currentPage, setCurrentPage } = useApp();
    const isActive = currentPage === to;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setCurrentPage(to);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(className, isActive && activeClassName)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
