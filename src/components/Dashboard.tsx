import { useApp } from '../context/AppContext';
import { Activity, Users, DollarSign, Package, TrendingUp } from 'lucide-react';
import { WeeklyAnalytics } from './WeeklyAnalytics';
import { AppLayout } from './AppLayout';

export function Dashboard() {
  const { currentUser, setCurrentPage } = useApp();

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Welcome back, {currentUser?.name || 'User'}!
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 mb-6 md:mb-8">
          <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Ingredients</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">127</p>
                <p className="text-xs sm:text-sm text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                  +12% from last week
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">8</p>
                <p className="text-xs sm:text-sm text-orange-600 mt-1">Needs attention</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-red-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">24</p>
                <p className="text-xs sm:text-sm text-blue-600 mt-1">Team members</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Cost Savings</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">$2.4k</p>
                <p className="text-xs sm:text-sm text-green-600 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                  +8% this month
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <WeeklyAnalytics />
          </div>
          
          <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-border">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => setCurrentPage('inventory')}
                className="w-full text-left p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 dark:from-blue-950/50 dark:to-cyan-950/50 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/50 transition-all border border-blue-200 dark:border-blue-800 min-h-[56px]"
              >
                <p className="font-semibold text-sm sm:text-base text-foreground">View Inventory</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Check stock levels</p>
              </button>
              <button 
                onClick={() => setCurrentPage('recipes')}
                className="w-full text-left p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 dark:from-purple-950/50 dark:to-pink-950/50 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 transition-all border border-purple-200 dark:border-purple-800 min-h-[56px]"
              >
                <p className="font-semibold text-sm sm:text-base text-foreground">Manage Recipes</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Update your recipes</p>
              </button>
              <button 
                onClick={() => setCurrentPage('audit-logs')}
                className="w-full text-left p-3 sm:p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 dark:from-green-950/50 dark:to-emerald-950/50 dark:hover:from-green-900/50 dark:hover:to-emerald-900/50 transition-all border border-green-200 dark:border-green-800 min-h-[56px]"
              >
                <p className="font-semibold text-sm sm:text-base text-foreground">View Audit Logs</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Track all changes</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
