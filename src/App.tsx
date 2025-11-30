import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './components/ThemeProvider';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { InventoryPage } from './components/InventoryPage';
import { RecipesPage } from './components/RecipesPage';
import { AuditLogPage } from './components/AuditLogPage';
import { SettingsPage } from './components/SettingsPage';
import { OrdersPage } from './components/OrdersPage';
import { PricingPage } from './components/PricingPage';
import { SuccessPage } from './components/SuccessPage';
import { CancelPage } from './components/CancelPage';

function AppContent() {
  const { currentPage, isLoading, isAuthenticated } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && currentPage !== 'login') {
    return <LoginPage />;
  }

  return (
    <>
      {currentPage === 'login' && <LoginPage />}
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'inventory' && <InventoryPage />}
      {currentPage === 'recipes' && <RecipesPage />}
      {currentPage === 'audit-logs' && <AuditLogPage />}
      {currentPage === 'settings' && <SettingsPage />}
      {currentPage === 'orders' && <OrdersPage />}
      {currentPage === 'pricing' && <PricingPage />}
      {currentPage === 'success' && <SuccessPage />}
      {currentPage === 'cancel' && <CancelPage />}
    </>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
