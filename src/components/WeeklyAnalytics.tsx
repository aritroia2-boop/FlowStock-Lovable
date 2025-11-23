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
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden">
        <div className="relative h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"></div>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
            <p className="text-gray-600 font-medium">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden">
        <div className="relative h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"></div>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <p className="text-gray-500 font-medium">No analytics data available yet</p>
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
    <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden">
      <div className="relative h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"></div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl">
              <TrendingUp size={24} className="text-white" />
            </div>
            Weekly Insights
            <span className="text-sm font-normal text-gray-500 ml-2">(Last 7 Days)</span>
          </h2>
          
          {analytics.totalSpending > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <DollarSign size={18} className="text-green-600" />
              <span className="font-bold text-green-700">
                Total: {analytics.totalSpending.toFixed(2)} lei
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Most Used Ingredients */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ChefHat size={16} className="text-blue-600" />
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
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                            <p className="font-semibold text-gray-900">{data.fullName}</p>
                            <p className="text-blue-600 font-medium">
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
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                No ingredient usage data
              </div>
            )}
          </div>

          {/* Chart 2: Most Prepared Recipes */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ChefHat size={16} className="text-purple-600" />
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
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                            <p className="font-semibold text-gray-900">{data.fullName}</p>
                            <p className="text-purple-600 font-medium">
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
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                No recipe data available
              </div>
            )}
          </div>

          {/* Chart 3: Spending Breakdown */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-green-600" />
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
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                            <p className="font-semibold text-gray-900">{data.fullName}</p>
                            <p className="text-green-600 font-medium">
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
              <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                No spending data available
              </div>
            )}
          </div>
        </div>

        {/* Additional insights */}
        {analytics.mostPreparedRecipes.length === 0 && 
         analytics.mostUsedIngredients.length === 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-blue-800 text-sm font-medium text-center">
              Start preparing recipes to see your weekly analytics! 🍳
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
