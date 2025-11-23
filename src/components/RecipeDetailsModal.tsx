import { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Edit2, Save, AlertTriangle, Lock, Eye, ChefHat } from 'lucide-react';
import { Recipe, Ingredient, RecipeIngredient, recipeIngredientsService, ingredientsService, recipesService, auditLogsService } from '../lib/database';
import { uploadRecipeImage, supabase } from '../lib/supabase';
import { compareQuantities, formatQuantity, normalizeToBaseUnit } from '../lib/unitConverter';
import { PermissionFlags } from '../lib/permissions';

interface RecipeDetailsModalProps {
  recipe: Recipe;
  onClose: () => void;
  onUpdate: () => void;
  permissions: PermissionFlags;
}

interface RecipeIngredientWithDetails extends RecipeIngredient {
  ingredient?: Ingredient;
}

export const RecipeDetailsModal = ({ recipe, onClose, onUpdate, permissions }: RecipeDetailsModalProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientWithDetails[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [missingIngredients, setMissingIngredients] = useState<string[]>([]);
  const [insufficientIngredients, setInsufficientIngredients] = useState<Array<{ name: string; required: string; available: string }>>([]);
  const [editFormData, setEditFormData] = useState({
    name: recipe.name,
    category: recipe.category,
    description: recipe.description || '',
    image_url: recipe.image_url || ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(recipe.image_url || '');
  const [newIngredient, setNewIngredient] = useState({
    ingredient_id: '',
    quantity: 0,
    unit: 'kg'
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isMakingRecipe, setIsMakingRecipe] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadRecipeData();
  }, [recipe.id]);

  const loadRecipeData = async () => {
    try {
      // Fetch ingredients based on recipe type
      let ingredients: Ingredient[];
      
      if (recipe.restaurant_id) {
        // Restaurant recipe → fetch ONLY restaurant ingredients
        ingredients = await ingredientsService.getRestaurant(recipe.restaurant_id);
      } else {
        // Personal recipe → fetch ONLY personal ingredients
        ingredients = await ingredientsService.getPersonal();
      }
      
      const recipeIngs = await recipeIngredientsService.getByRecipeId(recipe.id);

      setAllIngredients(ingredients);
      setRecipeIngredients(recipeIngs);

      const missing: string[] = [];
      const insufficient: Array<{ name: string; required: string; available: string }> = [];

      recipeIngs.forEach((ri: RecipeIngredientWithDetails) => {
        const inventoryItem = ingredients.find(inv => inv.id === ri.ingredient_id);
        if (!inventoryItem) {
          missing.push(ri.ingredient?.name || 'Unknown');
        } else {
          const comparison = compareQuantities(
            ri.quantity,
            ri.unit,
            inventoryItem.quantity,
            inventoryItem.unit
          );

          if (!comparison.hasEnough) {
            insufficient.push({
              name: ri.ingredient?.name || inventoryItem.name,
              required: formatQuantity(comparison.requiredNormalized, comparison.baseUnit),
              available: formatQuantity(comparison.availableNormalized, comparison.baseUnit)
            });
          }
        }
      });
      setMissingIngredients(missing);
      setInsufficientIngredients(insufficient);
    } catch (error) {
      console.error('Error loading recipe data:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        alert(`File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        e.target.value = '';
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload an image file (JPEG, PNG, WEBP, or GIF)');
        e.target.value = '';
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveRecipe = async () => {
    try {
      setIsUploading(true);
      let imageUrl = editFormData.image_url;

      if (imageFile) {
        imageUrl = await uploadRecipeImage(imageFile, recipe.id);
      }

      await recipesService.update(recipe.id, {
        name: editFormData.name,
        category: editFormData.category,
        description: editFormData.description,
        image_url: imageUrl
      });

      setIsEditMode(false);
      setImageFile(null);
      onUpdate();
    } catch (error) {
      console.error('Error saving recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save recipe. Please try again.';
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.ingredient_id || newIngredient.quantity <= 0) {
      alert('Please select an ingredient and enter a valid quantity.');
      return;
    }

    try {
      await recipeIngredientsService.create({
        recipe_id: recipe.id,
        ingredient_id: newIngredient.ingredient_id,
        quantity: newIngredient.quantity,
        unit: newIngredient.unit
      });

      setNewIngredient({ ingredient_id: '', quantity: 0, unit: 'kg' });
      loadRecipeData();
    } catch (error) {
      console.error('Error adding ingredient:', error);
      alert('Failed to add ingredient. Please try again.');
    }
  };

  const handleRemoveIngredient = async (ingredientId: string) => {
    try {
      await recipeIngredientsService.delete(ingredientId);
      loadRecipeData();
    } catch (error) {
      console.error('Error removing ingredient:', error);
    }
  };

  const handleMakeRecipe = async () => {
    try {
      setIsMakingRecipe(true);
      setErrorMessage('');
      setSuccessMessage('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const recipeIngs = await recipeIngredientsService.getByRecipeId(recipe.id);
      
      // Fetch ingredients based on recipe type (same logic as loadRecipeData)
      let allIngredients: Ingredient[];
      if (recipe.restaurant_id) {
        allIngredients = await ingredientsService.getRestaurant(recipe.restaurant_id);
      } else {
        allIngredients = await ingredientsService.getPersonal();
      }

      const ingredientsToUpdate: Array<{
        ingredient: Ingredient;
        recipeIngredient: RecipeIngredientWithDetails;
        newQuantity: number;
      }> = [];

      for (const ri of recipeIngs) {
        const inventoryItem = allIngredients.find(inv => inv.id === ri.ingredient_id);

        if (!inventoryItem) {
          throw new Error('Insufficient stock for this recipe.');
        }

        const comparison = compareQuantities(
          ri.quantity,
          ri.unit,
          inventoryItem.quantity,
          inventoryItem.unit
        );

        if (!comparison.hasEnough) {
          throw new Error('Insufficient stock for this recipe.');
        }

        const normalizedRequired = normalizeToBaseUnit(ri.quantity, ri.unit);
        const normalizedAvailable = normalizeToBaseUnit(inventoryItem.quantity, inventoryItem.unit);

        if (normalizedRequired.baseUnit !== normalizedAvailable.baseUnit) {
          throw new Error('Insufficient stock for this recipe.');
        }

        const newQuantityNormalized = normalizedAvailable.value - normalizedRequired.value;

        let newQuantity: number;
        if (inventoryItem.unit.toLowerCase() === 'kg' || inventoryItem.unit.toLowerCase() === 'l') {
          newQuantity = newQuantityNormalized / 1000;
        } else {
          newQuantity = newQuantityNormalized;
        }

        ingredientsToUpdate.push({
          ingredient: inventoryItem,
          recipeIngredient: ri,
          newQuantity: newQuantity
        });
      }

      for (const { ingredient, recipeIngredient, newQuantity } of ingredientsToUpdate) {
        await ingredientsService.update(ingredient.id, {
          quantity: newQuantity
        });

        await auditLogsService.create({
          user_id: user.id,
          user_name: user.email || 'Unknown',
          operation: `Recipe: ${recipe.name}`,
          table_name: 'ingredients',
          record_id: ingredient.id,
          old_values: { 
            quantity: ingredient.quantity, 
            name: ingredient.name,
            recipe: recipe.name,
            amount_used: recipeIngredient.quantity
          },
          new_values: { 
            quantity: newQuantity, 
            name: ingredient.name,
            recipe: recipe.name,
            amount_used: recipeIngredient.quantity
          }
        });
      }

      setSuccessMessage('Recipe completed successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);

      await loadRecipeData();
    } catch (error: any) {
      console.error('Error making recipe:', error);
      setErrorMessage(error.message || 'Failed to complete recipe.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsMakingRecipe(false);
    }
  };

  const calculateRawCost = () => {
    let total = 0;
    recipeIngredients.forEach((ri) => {
      if (ri.ingredient) {
        total += (ri.ingredient.quantity > 0 ? (ri.quantity / ri.ingredient.quantity) * 1.5 : 0);
      }
    });
    return total;
  };

  const rawCost = calculateRawCost();
  const laborCost = rawCost * 0.3;
  const overheadCost = 1.5;
  const totalCost = rawCost + laborCost + overheadCost;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-3xl font-bold text-gray-900">Recipe Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="p-8">
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3">
              <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800">{successMessage}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <AlertCircle size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">{errorMessage}</p>
              </div>
            </div>
          )}

          {(missingIngredients.length > 0 || insufficientIngredients.length > 0) && (
            <div className="mb-6 space-y-3">
              {missingIngredients.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Missing Ingredients</p>
                    <p className="text-red-600 text-sm">
                      The following ingredients are not in your inventory: {missingIngredients.join(', ')}
                    </p>
                  </div>
                </div>
              )}
              {insufficientIngredients.length > 0 && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
                  <AlertTriangle size={24} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-800">Insufficient Quantities</p>
                    <div className="text-orange-600 text-sm space-y-1 mt-2">
                      {insufficientIngredients.map((item, index) => (
                        <div key={index}>
                          <span className="font-medium">{item.name}:</span> Need {item.required}, have {item.available}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-gradient-to-br from-slate-600 to-slate-800 rounded-3xl p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-4 left-6 flex items-center gap-2 text-white">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-bold text-lg">FlowStock</span>
            </div>

            <div className="mt-8">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={recipe.name}
                  className="w-full h-64 object-cover rounded-2xl"
                />
              ) : (
                <div className="w-full h-64 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-2xl flex items-center justify-center">
                  <p className="text-white/70 text-lg">No image available</p>
                </div>
              )}
            </div>
          </div>

          {isEditMode && (
            <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 text-blue-800">
                <AlertCircle size={20} />
                <p className="font-medium">
                  {recipe.restaurant_id 
                    ? 'Editing Restaurant Recipe - Only restaurant ingredients are available'
                    : 'Editing Personal Recipe - Only your personal ingredients are available'
                  }
                </p>
              </div>
            </div>
          )}

          {isEditMode ? (
            <div className="mb-6 space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                <label className="block text-lg font-semibold text-gray-900 mb-3">Recipe Image</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white rounded-xl cursor-pointer shadow-lg hover:shadow-xl transition-all font-medium">
                    <Upload size={22} />
                    <span>Choose Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  {imagePreview && (
                    <div className="flex-1">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-40 w-full max-w-md object-cover rounded-xl border-2 border-blue-300 shadow-md"
                      />
                      <p className="text-sm text-gray-600 mt-2">Preview of selected image</p>
                    </div>
                  )}
                  {!imagePreview && (
                    <p className="text-gray-600">No image selected</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipe Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                >
                  <option>Appetizers</option>
                  <option>Main Courses</option>
                  <option>Desserts</option>
                  <option>Beverages</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  placeholder="Enter recipe description..."
                />
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{recipe.name}</h3>
              <p className="text-gray-600 mb-2">{recipe.category}</p>
              {recipe.description && (
                <p className="text-gray-700">{recipe.description}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Ingredients</h3>
              <div className="space-y-3">
                {recipeIngredients.map((ri) => {
                  const inventoryItem = allIngredients.find(inv => inv.id === ri.ingredient_id);
                  let status: 'available' | 'insufficient' | 'missing' = 'missing';
                  let statusInfo = '';

                  if (inventoryItem) {
                    const comparison = compareQuantities(
                      ri.quantity,
                      ri.unit,
                      inventoryItem.quantity,
                      inventoryItem.unit
                    );

                    if (comparison.hasEnough) {
                      status = 'available';
                    } else {
                      status = 'insufficient';
                      statusInfo = `Need ${formatQuantity(comparison.requiredNormalized, comparison.baseUnit)}, have ${formatQuantity(comparison.availableNormalized, comparison.baseUnit)}`;
                    }
                  }

                  return (
                    <div key={ri.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {status === 'available' && (
                          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                        )}
                        {status === 'insufficient' && (
                          <AlertTriangle size={20} className="text-orange-500 flex-shrink-0" />
                        )}
                        {status === 'missing' && (
                          <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <span className="text-gray-700">
                            {ri.ingredient?.name || 'Unknown'} ({ri.quantity} {ri.unit})
                          </span>
                          {status === 'insufficient' && (
                            <div className="text-xs text-orange-600 mt-1">
                              {statusInfo}
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditMode && (
                        <button
                          onClick={() => handleRemoveIngredient(ri.id)}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {isEditMode && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Add Ingredient</h4>
                  <div className="space-y-2">
                    <select
                      value={newIngredient.ingredient_id}
                      onChange={(e) => setNewIngredient({ ...newIngredient, ingredient_id: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                    >
                      <option value="">
                        {recipe.restaurant_id 
                          ? 'Select restaurant ingredient...' 
                          : 'Select personal ingredient...'
                        }
                      </option>
                      {allIngredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={newIngredient.quantity || ''}
                        onChange={(e) => setNewIngredient({ ...newIngredient, quantity: Number(e.target.value) })}
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                      />
                      <select
                        value={newIngredient.unit}
                        onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                        className="w-24 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                      >
                        <option>kg</option>
                        <option>g</option>
                        <option>l</option>
                        <option>ml</option>
                        <option>pcs</option>
                      </select>
                    </div>
                    <button
                      onClick={handleAddIngredient}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Cost Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Raw Ingredients:</span>
                  <span className="font-semibold">${rawCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Labor (Est.):</span>
                  <span className="font-semibold">${laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Overhead (Est.):</span>
                  <span className="font-semibold">${overheadCost.toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-gray-300">
                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">TOTAL COST:</span>
                      <span className="text-2xl font-bold text-blue-600">${totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            {isEditMode ? (
              <>
                <button
                  onClick={() => {
                    setIsEditMode(false);
                    setEditFormData({
                      name: recipe.name,
                      category: recipe.category,
                      description: recipe.description || '',
                      image_url: recipe.image_url || ''
                    });
                    setImagePreview(recipe.image_url || '');
                    setImageFile(null);
                  }}
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRecipe}
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  disabled={isUploading}
                >
                  <Save size={20} />
                  {isUploading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                {permissions.canEditRecipes ? (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    <Edit2 size={20} />
                    Edit Recipe
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-8 py-4 bg-slate-100 text-slate-400 rounded-2xl font-semibold">
                    <Lock size={20} />
                    <span>View Only</span>
                  </div>
                )}
                <button
                  onClick={handleMakeRecipe}
                  disabled={isMakingRecipe || missingIngredients.length > 0 || insufficientIngredients.length > 0}
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChefHat size={20} />
                  {isMakingRecipe ? 'Making...' : 'Make Recipe'}
                </button>
                <button
                  onClick={onClose}
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
