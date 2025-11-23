import { useState, useEffect } from 'react';
import { Home, Package, BookOpen, Truck, ShoppingBag, FileText, ChefHat, Bell, Settings, Leaf, TrendingUp, AlertTriangle, CheckCircle, AlertCircle, LogOut, XCircle, Users, Building2, Shield, Info, Plus, Minus, Edit3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ingredientsService, recipesService, recipeIngredientsService, notificationsService, teamMembersService, auditLogsService, Ingredient, Team, TeamMember, AuditLog } from '../lib/database';
import { compareQuantities } from '../lib/unitConverter';
import { NotificationsModal } from './NotificationsModal';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { RoleBadge } from './RoleBadge';

export const Dashboard = () => {
  const { currentUser, setCurrentPage, logout, setInventoryFilter } = useApp();
  const { restaurantRole, permissions } = usePermissions();
  const [stats, setStats] = useState({
    totalIngredients: 0,
    totalRecipes: 0,
    lowStockCount: 0,
    lowStockItems: [] as string[],
    unavailableRecipes: 0
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [myTeams, setMyTeams] = useState<(TeamMember & { teams: Team })[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; address: string } | null>(null);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [recentActivities, setRecentActivities] = useState<AuditLog[]>([]);

  useEffect(() => {
    loadStats();
    loadNotificationCount();
    loadMyTeams();
    loadRestaurantInfo();
    loadRecentActivities();

    if (currentUser?.id) {
      const notificationSub = notificationsService.subscribeToNotifications(
        currentUser.id,
        () => {
          loadNotificationCount();
          loadMyTeams();
        }
      );

      const auditLogSub = supabase
        .channel('audit_logs_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'audit_logs' },
          () => {
            loadRecentActivities();
          }
        )
        .subscribe();

      return () => {
        notificationSub.unsubscribe();
        auditLogSub.unsubscribe();
      };
    }
  }, [currentUser?.id, currentUser?.restaurant_id]);

  const loadNotificationCount = async () => {
    try {
      const count = await notificationsService.getUnreadCount();
      setNotificationCount(count);
    } catch (error) {
      console.error('Error loading notification count:', error);
    }
  };

  const loadMyTeams = async () => {
    try {
      if (!currentUser?.id) return;
      const teams = await teamMembersService.getByProfileId(currentUser.id);
      setMyTeams(teams.filter(t => t.status === 'active'));
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadRestaurantInfo = async () => {
    try {
      if (!currentUser?.restaurant_id) {
        setRestaurantInfo(null);
        return;
      }

      const { data, error } = await supabase
        .from('restaurants')
        .select('name, address')
        .eq('id', currentUser.restaurant_id)
        .maybeSingle();

      if (error) {
        console.error('Error loading restaurant:', error);
        return;
      }

      setRestaurantInfo(data);
    } catch (error) {
      console.error('Error loading restaurant info:', error);
    }
  };

  const loadStats = async () => {
    try {
      const ingredients = await ingredientsService.getAll();
      const recipes = await recipesService.getAll();

      const lowStockIngredients = ingredients.filter(
        (ing: Ingredient) => ing.quantity <= ing.minimum_stock
      );

      let unavailableCount = 0;
      for (const recipe of recipes) {
        const recipeIngs = await recipeIngredientsService.getByRecipeId(recipe.id);
        let canMake = true;

        for (const ri of recipeIngs) {
          const inventoryItem = ingredients.find(inv => inv.id === ri.ingredient_id);
          if (!inventoryItem) {
            canMake = false;
            break;
          }

          const comparison = compareQuantities(
            ri.quantity,
            ri.unit,
            inventoryItem.quantity,
            inventoryItem.unit
          );

          if (!comparison.hasEnough) {
            canMake = false;
            break;
          }
        }

        if (!canMake) {
          unavailableCount++;
        }
      }

      setStats({
        totalIngredients: ingredients.length,
        totalRecipes: recipes.length,
        lowStockCount: lowStockIngredients.length,
        lowStockItems: lowStockIngredients.slice(0, 3).map((ing: Ingredient) => ing.name),
        unavailableRecipes: unavailableCount
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const allLogs = await auditLogsService.getAll();
      const sortedLogs = allLogs.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setRecentActivities(sortedLogs.slice(0, 5));
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const getActivityStyle = (operation: string) => {
    const lowerOp = operation.toLowerCase();

    if (lowerOp === 'added' || lowerOp.includes('created')) {
      return {
        bgGradient: 'from-green-50 to-emerald-50',
        border: 'border-green-100',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        icon: Plus
      };
    }

    if (lowerOp === 'removed' || lowerOp.includes('deleted')) {
      return {
        bgGradient: 'from-red-50 to-orange-50',
        border: 'border-red-100',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        icon: Minus
      };
    }

    if (lowerOp === 'adjusted' || lowerOp.includes('updated') || lowerOp.includes('edited')) {
      return {
        bgGradient: 'from-blue-50 to-cyan-50',
        border: 'border-blue-100',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        icon: Edit3
      };
    }

    if (lowerOp.startsWith('recipe:')) {
      return {
        bgGradient: 'from-purple-50 to-pink-50',
        border: 'border-purple-100',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        icon: ChefHat
      };
    }

    return {
      bgGradient: 'from-blue-50 to-cyan-50',
      border: 'border-blue-100',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: CheckCircle
    };
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return activityTime.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -ml-32 -mb-32"></div>

          <div className="relative z-10 p-6">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-3 rounded-2xl shadow-lg shadow-blue-500/50">
                  <ChefHat size={28} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Kitchen</h2>
                  <p className="text-xs text-slate-400">Management</p>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mt-6"></div>
            </div>

            <nav className="space-y-2">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="w-full group relative flex items-center gap-3 px-4 py-3 text-white bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <Home size={18} />
                </div>
                <span className="relative">Dashboard</span>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-l-full"></div>
              </button>

              <button
                onClick={() => setCurrentPage('inventory')}
                className="w-full group relative flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:bg-white/5 backdrop-blur-sm"
              >
                <div className="relative bg-slate-700/50 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-400 p-2 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  <Package size={18} />
                </div>
                <span className="relative">Ingredients</span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-600 rounded-full group-hover:bg-cyan-400 transition-colors duration-300"></div>
              </button>

              <button
                onClick={() => setCurrentPage('recipes')}
                className="w-full group relative flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:bg-white/5 backdrop-blur-sm"
              >
                <div className="relative bg-slate-700/50 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-400 p-2 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  <BookOpen size={18} />
                </div>
                <span className="relative">Recipes</span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-600 rounded-full group-hover:bg-cyan-400 transition-colors duration-300"></div>
              </button>

              <button
                className="w-full group relative flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:bg-white/5 backdrop-blur-sm"
              >
                <div className="relative bg-slate-700/50 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-400 p-2 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  <Truck size={18} />
                </div>
                <span className="relative">Suppliers</span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-600 rounded-full group-hover:bg-cyan-400 transition-colors duration-300"></div>
              </button>

              <button
                className="w-full group relative flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:bg-white/5 backdrop-blur-sm"
              >
                <div className="relative bg-slate-700/50 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-400 p-2 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  <ShoppingBag size={18} />
                </div>
                <span className="relative">Orders</span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-600 rounded-full group-hover:bg-cyan-400 transition-colors duration-300"></div>
              </button>

              <button
                onClick={() => setCurrentPage('audit-logs')}
                className="w-full group relative flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white rounded-xl font-medium transition-all duration-300 hover:bg-white/5 backdrop-blur-sm"
              >
                <div className="relative bg-slate-700/50 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-cyan-400 p-2 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/30">
                  <FileText size={18} />
                </div>
                <span className="relative">Reports</span>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-600 rounded-full group-hover:bg-cyan-400 transition-colors duration-300"></div>
              </button>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-4"></div>
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm rounded-xl border border-slate-700/50">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400">System Status</p>
                  <p className="text-sm font-medium text-white">All Active</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-3 overflow-hidden">
          <header className="relative bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 p-2.5 mb-2.5 flex items-center justify-between overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 via-transparent to-cyan-50/50"></div>

            <div className="relative z-10 flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Home size={16} className="text-slate-400" />
                <span className="text-slate-400 text-sm">/</span>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Dashboard</h1>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200/50 shadow-sm">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-md flex items-center justify-center shadow-md">
                  <ChefHat size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Welcome back</p>
                  <p className="text-xs font-semibold text-slate-800">{currentUser?.name || 'User'}</p>
                </div>
              </div>

              {restaurantInfo && (
                <>
                  <div className="h-6 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200/50 shadow-sm">
                    <Building2 size={14} className="text-blue-600" />
                    <div>
                      <p className="text-[10px] text-blue-600 font-medium">Restaurant</p>
                      <p className="text-xs font-semibold text-slate-800">{restaurantInfo.name}</p>
                    </div>
                  </div>
                </>
              )}

              {currentUser?.role && currentUser.role !== 'none' && (
                <>
                  <div className="h-6 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>
                  <button
                    onClick={() => setShowRoleGuide(true)}
                    className="group relative flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border border-purple-200/50 shadow-sm transition-all"
                    title="Click to see role guide"
                  >
                    <Shield size={14} className="text-purple-600" />
                    <div className="text-left">
                      <p className="text-[10px] text-purple-600 font-medium">Role</p>
                      <p className="text-xs font-semibold text-slate-800 capitalize">{currentUser.role}</p>
                    </div>
                    <Info size={12} className="text-purple-400 group-hover:text-purple-600 transition-colors" />
                  </button>
                </>
              )}

              <div className="h-6 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>

              <button
                onClick={() => setShowNotifications(true)}
                className="relative group p-1.5 hover:bg-slate-100 rounded-lg transition-all duration-300"
                title="Notifications"
              >
                <Bell size={16} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
                {notificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white">
                    <span className="text-[10px] font-bold text-white">{notificationCount > 9 ? '9+' : notificationCount}</span>
                  </div>
                )}
              </button>

              <button
                onClick={() => setCurrentPage('settings')}
                className="group p-1.5 hover:bg-slate-100 rounded-lg transition-all duration-300"
              >
                <Settings size={16} className="text-slate-600 group-hover:text-blue-600 group-hover:rotate-90 transition-all duration-300" />
              </button>

              <div className="h-6 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent"></div>

              <button
                onClick={logout}
                className="group flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 text-red-600 rounded-lg transition-all duration-300 border border-red-200/50 shadow-sm hover:shadow-md"
                title="Logout"
              >
                <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-medium text-xs">Logout</span>
              </button>
            </div>
          </header>

          <div className="flex gap-2.5 mb-2.5">
            <div className="grid grid-cols-2 gap-2.5 max-w-xl flex-shrink-0">
            <button
              onClick={() => setCurrentPage('inventory')}
              className="group relative aspect-square bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 rounded-xl p-4 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10"></div>

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Leaf size={18} className="text-white" />
                  </div>
                  <div className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                    <span className="text-xs font-semibold">Active</span>
                  </div>
                </div>
                <h3 className="text-white/80 text-xs font-medium mb-2 uppercase tracking-wide">Total Ingredients</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-end gap-2 mb-3">
                    <p className="text-4xl font-bold tracking-tight">{stats.totalIngredients.toLocaleString()}</p>
                    <div className="p-1.5 bg-green-400/30 backdrop-blur-sm rounded-lg mb-1">
                      <TrendingUp size={16} className="text-green-100" />
                    </div>
                  </div>
                </div>
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-white/60 rounded-full"></div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('recipes')}
              className="group relative aspect-square bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]"></div>
              <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -ml-12 -mt-12"></div>

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white/80 text-xs font-medium uppercase tracking-wide">Total Recipes</h3>
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <BookOpen size={18} className="text-white" />
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                      <circle cx="48" cy="48" r="40" stroke="white" strokeWidth="6" fill="none" strokeDasharray="251.327" strokeDashoffset="62.832" strokeLinecap="round" className="drop-shadow-lg" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{stats.totalRecipes}</span>
                      <span className="text-xs text-white/70 mt-1">recipes</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg flex-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-white/80 text-xs font-medium">Ready</span>
                  </div>
                  <div className="px-2 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg">
                    <div className="text-sm font-bold">75%</div>
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setInventoryFilter('Low Stock');
                setCurrentPage('inventory');
              }}
              className="group relative aspect-square bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 rounded-xl p-4 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-yellow-300/10 rounded-full blur-xl"></div>

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                    <span className="text-xs font-bold uppercase tracking-wider">Low Stock</span>
                  </div>
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg animate-pulse">
                    <AlertTriangle size={18} className="text-yellow-200" />
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center mb-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-5xl font-bold tracking-tighter">{stats.lowStockCount}</p>
                    <span className="text-sm font-semibold text-white/70">items</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-300 to-red-400 rounded-full w-1/3 animate-pulse"></div>
                  </div>
                </div>

                <div className="space-y-1.5 p-2 bg-black/10 backdrop-blur-sm rounded-lg">
                  {stats.lowStockItems.slice(0, 2).map((item, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 bg-yellow-300 rounded-full animate-pulse" style={{ animationDelay: `${index * 200}ms` }}></div>
                      <span className="text-xs font-medium text-white/95 truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('recipes')}
              className="group relative aspect-square bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 rounded-xl p-4 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_3s_linear_infinite]"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl -mr-16 -mt-16"></div>

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                    <XCircle size={18} className="text-white" />
                  </div>
                  <div className="px-2 py-1 bg-red-900/30 backdrop-blur-sm rounded-full border border-red-400/30">
                    <span className="text-xs font-semibold">Alert</span>
                  </div>
                </div>

                <h3 className="text-white/80 text-xs font-medium mb-3 uppercase tracking-wide">Unavailable Recipes</h3>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-end gap-2">
                      <p className="text-5xl font-bold tracking-tight">{stats.unavailableRecipes}</p>
                      <div className="mb-2 p-1.5 bg-red-900/40 backdrop-blur-sm rounded-lg">
                        <AlertCircle size={16} className="text-red-200" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2 py-2 bg-red-900/20 backdrop-blur-sm rounded-lg border border-red-400/20">
                  <div className="w-1.5 h-1.5 bg-red-300 rounded-full"></div>
                  <span className="text-white/80 text-xs font-medium">Cannot be prepared</span>
                </div>
              </div>
            </button>
            </div>

            {myTeams.length > 0 && (
              <div className="w-80 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-lg border border-blue-200/50 overflow-hidden flex-shrink-0">
                <div className="relative h-1 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500"></div>

                <div className="p-4">
                  <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users size={18} className="text-blue-600" />
                    </div>
                    My Teams
                  </h2>

                  <div className="space-y-2">
                    {myTeams.map((teamMember) => (
                      <div
                        key={teamMember.id}
                        className="bg-white rounded-xl p-3 border border-blue-100 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                              {teamMember.teams?.name}
                            </h3>
                            {teamMember.teams?.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                {teamMember.teams.description}
                              </p>
                            )}
                          </div>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg whitespace-nowrap">
                            {teamMember.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage('settings')}
                    className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg text-sm"
                  >
                    View All Teams
                  </button>
                </div>
              </div>
            )}

            <div className="w-80 bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden flex-shrink-0 self-stretch">
              <div className="relative h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"></div>

              <div className="p-3 flex flex-col" style={{ height: 'calc(100% - 0.125rem)' }}>
                <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-full"></div>
                  Recent Activity
                </h2>
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {recentActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="p-3 bg-gray-100 rounded-full mb-3">
                        <FileText size={24} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm font-medium">No recent activity</p>
                      <p className="text-gray-400 text-xs mt-1">Actions will appear here</p>
                    </div>
                  ) : (
                    recentActivities.map((activity) => {
                      const style = getActivityStyle(activity.operation);
                      const Icon = style.icon;

                      return (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-2 p-2.5 bg-gradient-to-r ${style.bgGradient} rounded-lg border ${style.border} hover:shadow-md transition-shadow`}
                        >
                          <div className={`p-1.5 ${style.iconBg} rounded-md`}>
                            <Icon size={16} className={style.iconColor} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 font-medium text-sm truncate">
                              {activity.operation === 'Added' && `Added ${activity.amount} ${activity.ingredient_name}`}
                              {activity.operation === 'Removed' && `Removed ${activity.ingredient_name}`}
                              {activity.operation === 'Adjusted' && `Adjusted ${activity.ingredient_name}`}
                              {activity.operation.startsWith('Recipe:') && activity.operation}
                              {!['Added', 'Removed', 'Adjusted'].includes(activity.operation) && !activity.operation.startsWith('Recipe:') && `${activity.operation} ${activity.ingredient_name}`}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-gray-500 text-xs truncate">{activity.user_name}</p>
                              <span className="text-gray-400 text-xs">•</span>
                              <p className="text-gray-400 text-xs whitespace-nowrap">{getRelativeTime(activity.timestamp)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden">
            <div className="relative h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"></div>

            <div className="p-4 grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Ingredient Usage</h3>
                <div className="flex items-center justify-center">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="56" cy="56" r="48" stroke="#E5E7EB" strokeWidth="10" fill="none" />
                      <circle cx="56" cy="56" r="48" stroke="url(#gradient1)" strokeWidth="10" fill="none" strokeDasharray="301.593" strokeDashoffset="60.319" strokeLinecap="round" />
                      <defs>
                        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06B6D4" />
                          <stop offset="50%" stopColor="#EC4899" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900">78%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l border-gray-200 pl-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Order Frequency</h3>
                <div className="h-24 flex items-end">
                  <svg className="w-full h-full" viewBox="0 0 300 100">
                    <defs>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                      </linearGradient>
                    </defs>
                    <polyline points="0,80 50,70 100,75 150,60 200,50 250,40 300,30" fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-gray-500 text-xs mt-1 text-center">Orders per month</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationUpdate={loadNotificationCount}
      />

      {showRoleGuide && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-pink-400 px-8 py-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Shield size={28} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Role Guide</h2>
                    <p className="text-white/80 text-sm">Understanding team hierarchy and permissions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRoleGuide(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all"
                >
                  <XCircle size={24} className="text-white" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl shadow-lg">
                    <Shield size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">Owner</h3>
                      <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">Highest</span>
                    </div>
                    <p className="text-slate-700 mb-3">Full control over the restaurant and all operations.</p>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-800">Permissions:</p>
                      <ul className="space-y-1.5 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          Create and manage restaurant profile
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          Add, remove, and manage employees
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          Create and manage teams
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          Full access to all ingredients and recipes
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          View and manage all audit logs and reports
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          Assign team roles and permissions
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl shadow-lg">
                    <Users size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">Employee</h3>
                      <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full uppercase tracking-wide">Standard</span>
                    </div>
                    <p className="text-slate-700 mb-3">Standard staff member with access to daily operations.</p>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-800">Permissions:</p>
                      <ul className="space-y-1.5 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          View and manage shared ingredients
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          View and use shared recipes
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          Create and manage personal items
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          View audit logs for their actions
                        </li>
                        <li className="flex items-center gap-2">
                          <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
                          Cannot manage other employees
                        </li>
                        <li className="flex items-center gap-2">
                          <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
                          Cannot modify restaurant settings
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-400 rounded-xl shadow-lg">
                    <Users size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Team Roles</h3>
                    <p className="text-slate-700 mb-4">Additional roles within teams for specialized responsibilities.</p>

                    <div className="space-y-4">
                      <div className="bg-white/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <h4 className="font-bold text-slate-900">Manager</h4>
                        </div>
                        <p className="text-sm text-slate-600">Team leadership role with enhanced permissions for their team.</p>
                      </div>

                      <div className="bg-white/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <h4 className="font-bold text-slate-900">Supervisor</h4>
                        </div>
                        <p className="text-sm text-slate-600">Oversees team operations and assists managers.</p>
                      </div>

                      <div className="bg-white/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <h4 className="font-bold text-slate-900">Member</h4>
                        </div>
                        <p className="text-sm text-slate-600">Standard team member with access to team resources.</p>
                      </div>

                      <div className="bg-white/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <h4 className="font-bold text-slate-900">Trainee</h4>
                        </div>
                        <p className="text-sm text-slate-600">New team member in training with supervised access.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-400 rounded-xl shadow-lg">
                    <Info size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Current Role</h3>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-400 text-white text-lg font-bold rounded-xl shadow-lg capitalize">
                        {currentUser?.role || 'None'}
                      </span>
                      {restaurantInfo && (
                        <span className="px-4 py-2 bg-white text-slate-800 text-sm font-semibold rounded-xl border-2 border-amber-300">
                          @ {restaurantInfo.name}
                        </span>
                      )}
                    </div>
                    {myTeams.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-slate-800 mb-2">Your Teams:</p>
                        <div className="flex flex-wrap gap-2">
                          {myTeams.map((team) => (
                            <div key={team.id} className="px-3 py-1.5 bg-white rounded-lg border border-amber-200 shadow-sm">
                              <span className="text-sm font-medium text-slate-700">{team.teams.name}</span>
                              <span className="text-xs text-slate-500 ml-2">({team.role})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gradient-to-r from-slate-50 to-slate-100 px-8 py-4 rounded-b-3xl border-t border-slate-200">
              <button
                onClick={() => setShowRoleGuide(false)}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-400 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
