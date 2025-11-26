import { ReactNode } from 'react';
import { ResponsiveSidebar } from './ResponsiveSidebar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex">
      <ResponsiveSidebar />
      
      <main className="flex-1 w-full md:w-auto pb-20 md:pb-0">
        {children}
      </main>

      <MobileNav />
    </div>
  );
};
