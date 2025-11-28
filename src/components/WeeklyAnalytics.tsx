import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, ChefHat, Loader2 } from 'lucide-react';
import { calculateWeeklyAnalytics, type WeeklyAnalytics as WeeklyAnalyticsData } from '../lib/analytics';
import { useApp } from '../context/AppContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const WeeklyAnalytics = () => {
  const { currentUser } = useApp();
  const [analytics, setAnalytics] = useState<WeeklyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [currentUser?.id, currentUser?.restaurant_id]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!currentUser?.id) return;

      const data = await calculateWeeklyAnalytics(
        currentUser.id,
        currentUser.restaurant_id
      );
      
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="relative p-[3px] rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-xl animate-pulse">
        <div className="bg-card rounded-[13px] p-6 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="relative p-[3px] rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-xl">
        <div className="bg-card rounded-[13px] p-6 flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground font-medium">No analytics data available yet</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const ingredientChartData = analytics.mostUsedIngredients.map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    quantity: parseFloat(item.quantity.toFixed(2)),
    fullName: item.name,
    unit: item.unit
  }));

  const recipeChartData = analytics.mostPreparedRecipes.map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    count: item.count,
    fullName: item.name
  }));

  const spendingChartData = analytics.highestSpending.map((item, index) => ({
    name: item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name,
    value: parseFloat(item.cost.toFixed(2)),
    fullName: item.name,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="relative p-[3px] rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-xl">
      <div className="bg-card rounded-[13px] overflow-hidden">
        {/* Animated gradient header bar */}
        <div className="h-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-[length:200%_100%] animate-shimmer"></div>
        
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl shadow-lg shadow-blue-500/25 animate-icon-pulse">
                <TrendingUp size={24} className="text-white" />
              </div>
              Weekly Insights
              <span className="text-sm font-normal text-muted-foreground">(Last 7 Days)</span>
            </h2>
            
            {analytics.totalSpending > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 rounded-xl border border-green-500/30 shadow-sm">
                <div className="p-1.5 bg-green-500 rounded-lg">
                  <DollarSign size={14} className="text-white" />
                </div>
                <span className="font-bold text-green-600 dark:text-green-400">
                  Total: {analytics.totalSpending.toFixed(2)} lei
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Chart 1: Most Used Ingredients */}
            <div className="group relative p-[2px] rounded-xl bg-gradient-to-br from-blue-400 via-cyan-500 to-blue-600 hover:from-blue-500 hover:via-cyan-600 hover:to-blue-700 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.01]">
              <div className="bg-card rounded-[10px] p-4 h-full">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500 rounded-lg group-hover:animate-icon-pulse">
                    <ChefHat size={14} className="text-white" />
                  </div>
                  Most Used Ingredients
                </h3>
            {ingredientChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ingredientChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card p-3 rounded-lg shadow-xl border border-border backdrop-blur-xl">
                            <p className="font-semibold text-foreground">{data.fullName}</p>
                            <p className="text-blue-500 font-medium">
                              {data.quantity} {data.unit}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="quantity" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  No ingredient usage data
                </div>
              )}
              </div>
            </div>

            {/* Chart 2: Most Prepared Recipes */}
            <div className="group relative p-[2px] rounded-xl bg-gradient-to-br from-purple-400 via-violet-500 to-purple-600 hover:from-purple-500 hover:via-violet-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.01]">
              <div className="bg-card rounded-[10px] p-4 h-full">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500 rounded-lg group-hover:animate-icon-pulse">
                    <ChefHat size={14} className="text-white" />
                  </div>
                  Most Prepared Recipes
                </h3>
            {recipeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={recipeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card p-3 rounded-lg shadow-xl border border-border backdrop-blur-xl">
                            <p className="font-semibold text-foreground">{data.fullName}</p>
                            <p className="text-purple-500 font-medium">
                              Prepared {data.count} time{data.count > 1 ? 's' : ''}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" fill="#a855f7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  No recipe data available
                </div>
              )}
              </div>
            </div>

            {/* Chart 3: Spending Breakdown */}
            <div className="group relative p-[2px] rounded-xl bg-gradient-to-br from-green-400 via-emerald-500 to-green-600 hover:from-green-500 hover:via-emerald-600 hover:to-green-700 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.01]">
              <div className="bg-card rounded-[10px] p-4 h-full">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="p-1.5 bg-green-500 rounded-lg group-hover:animate-icon-pulse">
                    <DollarSign size={14} className="text-white" />
                  </div>
                  Spending Breakdown
                </h3>
            {spendingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={spendingChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {spendingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card p-3 rounded-lg shadow-xl border border-border backdrop-blur-xl">
                            <p className="font-semibold text-foreground">{data.fullName}</p>
                            <p className="text-green-500 font-medium">
                              {data.value.toFixed(2)} lei
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                  No spending data available
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Additional insights */}
          {analytics.mostPreparedRecipes.length === 0 && 
           analytics.mostUsedIngredients.length === 0 && (
            <div className="mt-4 p-4 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 rounded-xl">
              <p className="text-blue-600 dark:text-blue-400 text-sm font-medium text-center">
                Start preparing recipes to see your weekly analytics! 🍳
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
