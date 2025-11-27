import { useState, useEffect } from 'react';
import { Plus, Utensils, Home, AlertCircle, Settings, User, Building2, Lock } from 'lucide-react';
import { recipesService, Recipe, recipeIngredientsService, ingredientsService } from '../lib/database';
import { useApp } from '../context/AppContext';
import { RecipeDetailsModal } from './RecipeDetailsModal';
import { compareQuantities } from '../lib/unitConverter';
import { usePermissions } from '../hooks/usePermissions';
import { RoleBadge } from './RoleBadge';

export const RecipesPage = () => {
  const { currentUser, setCurrentPage } = useApp();
  const { restaurantRole, getPermissionsForContext } = usePermissions();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeMissingIngredients, setRecipeMissingIngredients] = useState<Record<string, number>>({});
  const [viewContext, setViewContext] = useState<'personal' | 'restaurant'>('personal');

  const permissions = getPermissionsForContext(viewContext);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category: 'Main Courses',
    cost: 0,
    is_shared: false,
    restaurant_id: null as string | null
  });

  useEffect(() => {
    loadRecipes();
  }, [viewContext]);

  const loadRecipes = async () => {
    try {
      let recipesData: Recipe[];
      if (viewContext === 'personal') {
        recipesData = await recipesService.getPersonal();
      } else if (viewContext === 'restaurant' && currentUser?.restaurant_id) {
        recipesData = await recipesService.getRestaurant(currentUser.restaurant_id);
      } else {
        recipesData = [];
      }
      const allIngredients = await ingredientsService.getAll();

      setRecipes(recipesData);

      const missingCounts: Record<string, number> = {};
      for (const recipe of recipesData) {
        const recipeIngs = await recipeIngredientsService.getByRecipeId(recipe.id);
        let missingCount = 0;
        recipeIngs.forEach((ri: any) => {
          const inventoryItem = allIngredients.find(inv => inv.id === ri.ingredient_id);
          if (!inventoryItem) {
            missingCount++;
          } else {
            const comparison = compareQuantities(
              ri.quantity,
              ri.unit,
              inventoryItem.quantity,
              inventoryItem.unit
            );
            if (!comparison.hasEnough) {
              missingCount++;
            }
          }
        });
        missingCounts[recipe.id] = missingCount;
      }
      setRecipeMissingIngredients(missingCounts);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const handleAddRecipe = async () => {
    try {
      const recipeData = {
        ...newRecipe,
        is_shared: viewContext === 'restaurant',
        restaurant_id: viewContext === 'restaurant' ? (currentUser?.restaurant_id || undefined) : undefined
      };
      await recipesService.create(recipeData);
      setShowAddModal(false);
      setNewRecipe({
        name: '',
        category: 'Main Courses',
        cost: 0,
        is_shared: false,
        restaurant_id: null
      });
      loadRecipes();
    } catch (error) {
      console.error('Error adding recipe:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="relative bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-3xl p-0.5 mb-8 shadow-2xl">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-cyan-50/50"></div>
            <div className="relative z-10 p-4 md:p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className="group p-3 bg-gradient-to-br from-slate-100 to-slate-50 hover:from-blue-100 hover:to-cyan-100 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
                  title="Go to Dashboard"
                >
                  <Home size={28} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Recipes</h1>
                    {currentUser?.restaurant_id && <RoleBadge role={restaurantRole} size="sm" />}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {permissions.isReadOnly ? 'View your culinary creations' : 'Discover and manage your culinary creations'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setCurrentPage('settings')}
                  className="group p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all duration-300"
                  title="Settings"
                >
                  <Settings size={24} className="text-slate-600 group-hover:text-blue-600 group-hover:rotate-90 transition-all duration-300" />
                </button>
                {permissions.canAddRecipes ? (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-2xl font-semibold text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    Add Recipe
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex items-center gap-3 px-8 py-4 bg-slate-200 text-slate-400 rounded-2xl font-semibold text-lg shadow-sm cursor-not-allowed"
                    title="Manager or Supervisor access required"
                  >
                    <Lock size={24} />
                    Add Recipe
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {currentUser?.restaurant_id && (
          <div className="mb-6 flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-slate-200 w-fit shadow-lg">
            <button
              onClick={() => setViewContext('personal')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                viewContext === 'personal'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User size={18} />
              Personal
            </button>
            <button
              onClick={() => setViewContext('restaurant')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                viewContext === 'restaurant'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 size={18} />
              Restaurant
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="group relative bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg hover:shadow-2xl border border-white/20 p-6 transform hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>

              <div className="relative z-10 flex items-center justify-center mb-6">
                {recipe.image_url ? (
                  <div className="relative w-full h-48 overflow-hidden rounded-xl shadow-md group-hover:shadow-xl transition-shadow duration-300">
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {recipeMissingIngredients[recipe.id] > 0 && (
                      <div className="absolute top-3 right-3 bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg shadow-red-500/50 animate-pulse border-2 border-white">
                        <AlertCircle size={20} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    {recipeMissingIngredients[recipe.id] > 0 && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-full w-9 h-9 flex items-center justify-center font-bold shadow-lg shadow-red-500/40 animate-pulse z-20">
                        <AlertCircle size={18} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
                    <div className="relative bg-gradient-to-br from-cyan-200 via-blue-300 to-cyan-200 p-8 rounded-full shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                      <Utensils size={48} className="text-slate-700" />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{recipe.name}</h3>
                  {recipe.is_shared ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-md whitespace-nowrap">
                      Restaurant
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-md whitespace-nowrap">
                      Personal
                    </span>
                  )}
                </div>
                <div className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-slate-100 to-slate-50 rounded-full mb-4">
                  <p className="text-sm text-slate-600 font-medium">{recipe.category}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-full font-semibold text-sm shadow-md shadow-blue-500/30 group-hover:shadow-lg group-hover:shadow-blue-500/40 transition-all">
                    ${recipe.cost.toFixed(2)}
                  </span>
                  {recipeMissingIngredients[recipe.id] > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 rounded-full">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      <span className="text-red-600 text-xs font-bold">
                        {recipeMissingIngredients[recipe.id]} missing
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-cyan-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Recipe</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipe Name</label>
                <input
                  type="text"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={newRecipe.category}
                  onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                >
                  <option>Appetizers</option>
                  <option>Main Courses</option>
                  <option>Desserts</option>
                  <option>Beverages</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRecipe.cost}
                  onChange={(e) => setNewRecipe({ ...newRecipe, cost: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRecipe}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300"
                >
                  Add Recipe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRecipe && (
        <RecipeDetailsModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onUpdate={async () => {
            await loadRecipes();
            setSelectedRecipe(null);
          }}
          permissions={permissions}
        />
      )}
    </div>
  );
};
