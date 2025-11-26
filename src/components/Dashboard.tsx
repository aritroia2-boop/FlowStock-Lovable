import { useApp } from '../context/AppContext';
import { Leaf, BookOpen, AlertTriangle, XCircle, Users, Plus, Minus, Edit3, FileText } from 'lucide-react';
import { WeeklyAnalytics } from './WeeklyAnalytics';
import { AppLayout } from './AppLayout';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type AuditLog = Tables<'audit_logs'>;
type TeamMember = Tables<'team_members'> & {
  teams: { name: string } | null;
};

export function Dashboard() {
  const { currentUser, setCurrentPage, setInventoryFilter } = useApp();
  const [stats, setStats] = useState({
    totalIngredients: 0,
    totalRecipes: 0,
    lowStockCount: 0,
    lowStockItems: [] as string[],
    unavailableRecipes: 0
  });
  const [recentActivities, setRecentActivities] = useState<AuditLog[]>([]);
  const [myTeams, setMyTeams] = useState<TeamMember[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; address: string } | null>(null);

  useEffect(() => {
    loadStats();
    loadRecentActivities();
    loadMyTeams();
    loadRestaurantInfo();

    // Real-time subscriptions
    const notificationsChannel = supabase
      .channel('dashboard-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        // Reload data on notification changes
      })
      .subscribe();

    const auditLogsChannel = supabase
      .channel('dashboard-audit-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
        loadRecentActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(auditLogsChannel);
    };
  }, []);

  const loadStats = async () => {
    try {
      const { data: ingredients } = await supabase.from('ingredients').select('*');
      const { data: recipes } = await supabase.from('recipes').select('*, recipe_ingredients(ingredient_id)');

      const totalIngredients = ingredients?.length || 0;
      const totalRecipes = recipes?.length || 0;

      const lowStock = ingredients?.filter(i => i.quantity <= i.low_stock_threshold) || [];
      const lowStockCount = lowStock.length;
      const lowStockItems = lowStock.slice(0, 3).map(i => i.name);

      let unavailableCount = 0;
      if (recipes && ingredients) {
        for (const recipe of recipes) {
          const recipeIngredients = recipe.recipe_ingredients || [];
          const hasUnavailableIngredient = recipeIngredients.some((ri: any) => {
            const ingredient = ingredients.find(i => i.id === ri.ingredient_id);
            return ingredient && ingredient.quantity <= 0;
          });
          if (hasUnavailableIngredient) unavailableCount++;
        }
      }

      setStats({
        totalIngredients,
        totalRecipes,
        lowStockCount,
        lowStockItems,
        unavailableRecipes: unavailableCount
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const loadMyTeams = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('team_members')
        .select('*, teams(name)')
        .eq('profile_id', user.id)
        .eq('status', 'active');
      setMyTeams(data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadRestaurantInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .eq('id', user.id)
        .single();

      if (profile?.restaurant_id) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name, address')
          .eq('id', profile.restaurant_id)
          .single();
        setRestaurantInfo(restaurant);
      }
    } catch (error) {
      console.error('Error loading restaurant:', error);
    }
  };

  const getActivityStyle = (operation: string) => {
    switch (operation.toLowerCase()) {
      case 'insert':
      case 'added':
        return { bg: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30', icon: Plus, iconColor: 'text-green-600' };
      case 'delete':
      case 'removed':
        return { bg: 'from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30', icon: Minus, iconColor: 'text-red-600' };
      case 'update':
      case 'adjusted':
        return { bg: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30', icon: Edit3, iconColor: 'text-blue-600' };
      default:
        return { bg: 'from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30', icon: FileText, iconColor: 'text-purple-600' };
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Welcome back, {currentUser?.name || 'User'}!
              {restaurantInfo && (
                <span className="ml-2 text-xs sm:text-sm">
                  • {restaurantInfo.name}
                </span>
              )}
            </p>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 mb-6 md:mb-8">
            {/* Total Ingredients - Purple to Pink */}
            <button 
              onClick={() => setCurrentPage('inventory')}
              className="group relative bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <Leaf size={20} className="text-white" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Active</span>
                </div>
                <p className="text-sm font-medium opacity-90 mb-1">Total Ingredients</p>
                <p className="text-3xl sm:text-4xl font-bold mb-2">{stats.totalIngredients}</p>
                <div className="w-full bg-white/20 rounded-full h-1.5 mb-1">
                  <div className="bg-white rounded-full h-1.5" style={{ width: '85%' }}></div>
                </div>
                <p className="text-xs opacity-75">In stock & ready</p>
              </div>
            </button>

            {/* Total Recipes - Cyan to Blue */}
            <button 
              onClick={() => setCurrentPage('recipes')}
              className="group relative bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <BookOpen size={20} className="text-white" />
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle cx="24" cy="24" r="20" stroke="white" strokeOpacity="0.2" strokeWidth="3" fill="none" />
                      <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="3" fill="none" strokeDasharray="125.6" strokeDashoffset="31.4" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">75%</span>
                  </div>
                </div>
                <p className="text-sm font-medium opacity-90 mb-1">Total Recipes</p>
                <p className="text-2xl sm:text-3xl font-bold mb-1">{stats.totalRecipes}</p>
                <p className="text-xs opacity-75">Ready to prepare</p>
              </div>
            </button>

            {/* Low Stock - Orange to Red */}
            <button 
              onClick={() => { setInventoryFilter('Low Stock'); setCurrentPage('inventory'); }}
              className="group relative bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle size={20} className="text-yellow-200 animate-pulse" />
                  <span className="text-xs bg-yellow-200/20 px-2 py-1 rounded-full">Alert</span>
                </div>
                <p className="text-sm font-medium opacity-90 mb-1">Low Stock Items</p>
                <p className="text-3xl sm:text-5xl font-bold mb-2">{stats.lowStockCount}</p>
                {stats.lowStockItems.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {stats.lowStockItems.map((item, idx) => (
                      <span key={idx} className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full truncate max-w-[80px]">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>

            {/* Unavailable Recipes - Red to Pink */}
            <button 
              onClick={() => setCurrentPage('recipes')}
              className="group relative bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <XCircle size={20} className="text-white" />
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Warning</span>
                </div>
                <p className="text-sm font-medium opacity-90 mb-1">Unavailable Recipes</p>
                <p className="text-3xl sm:text-5xl font-bold mb-2">{stats.unavailableRecipes}</p>
                <p className="text-xs opacity-75">Cannot be prepared</p>
              </div>
            </button>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* WeeklyAnalytics - spans 2 columns */}
            <div className="lg:col-span-2">
              <WeeklyAnalytics />
            </div>

            {/* Right Column: Recent Activity + My Teams */}
            <div className="space-y-4">
              {/* Recent Activity */}
              <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-lg overflow-hidden border border-border">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1"></div>
                <div className="p-4 sm:p-6">
                  <h2 className="text-base sm:text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <FileText size={18} />
                    Recent Activity
                  </h2>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {recentActivities.length > 0 ? (
                      recentActivities.map((activity) => {
                        const style = getActivityStyle(activity.operation);
                        const Icon = style.icon;
                        return (
                          <div key={activity.id} className={`p-3 rounded-lg bg-gradient-to-r ${style.bg} border border-border/50`}>
                            <div className="flex items-start gap-2">
                              <Icon size={14} className={`${style.iconColor} mt-0.5 flex-shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {activity.user_name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {activity.operation} • {activity.table_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {getRelativeTime(activity.created_at || '')}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>

              {/* My Teams (Conditional) */}
              {myTeams.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-xl shadow-lg overflow-hidden border border-blue-200 dark:border-blue-800">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1"></div>
                  <div className="p-4 sm:p-6">
                    <h2 className="text-base sm:text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                      <Users size={18} />
                      My Teams
                    </h2>
                    <div className="space-y-2">
                      {myTeams.map((team) => (
                        <div key={team.id} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-border/50">
                          <p className="text-sm font-medium text-foreground truncate">
                            {team.teams?.name || 'Team'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize mt-1">
                            Role: {team.role}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => setCurrentPage('settings')}
                      className="mt-4 w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      View All Teams →
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Actions (if no teams) */}
              {myTeams.length === 0 && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
