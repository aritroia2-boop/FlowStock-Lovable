import { ReactNode } from 'react';
import { useSwipeable } from 'react-swipeable';
import { ResponsiveSidebar } from './ResponsiveSidebar';
import { MobileNav } from './MobileNav';
import { useApp } from '../context/AppContext';

interface AppLayoutProps {
  children: ReactNode;
}

type Page = 'login' | 'signup' | 'dashboard' | 'inventory' | 'recipes' | 'audit-logs' | 'settings' | 'orders' | 'pricing';

// Define page navigation order
const PAGE_ORDER: Page[] = ['dashboard', 'inventory', 'recipes', 'orders', 'audit-logs', 'settings'];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { currentPage, setCurrentPage } = useApp();

  const handleSwipe = (direction: 'left' | 'right') => {
    // Only enable swipes on mobile devices
    if (window.innerWidth >= 768) return;

    const currentIndex = PAGE_ORDER.indexOf(currentPage);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (direction === 'left') {
      // Swipe left = next page
      nextIndex = currentIndex + 1;
      if (nextIndex >= PAGE_ORDER.length) return; // Don't wrap around
    } else {
      // Swipe right = previous page
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) return; // Don't wrap around
    }

    setCurrentPage(PAGE_ORDER[nextIndex]);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    trackMouse: false, // Only track touch events
    preventScrollOnSwipe: false,
    delta: 50, // Minimum swipe distance
  });

  return (
    <div className="min-h-screen bg-background flex">
      <ResponsiveSidebar />
      
      <main 
        {...swipeHandlers}
        className="flex-1 w-full md:w-auto pb-20 md:pb-0 touch-pan-y"
      >
        {children}
      </main>

      <MobileNav />
    </div>
  );
};
