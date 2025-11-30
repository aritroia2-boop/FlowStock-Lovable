import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Edit2, Home, Settings, User, Building2, Eye, Lock } from 'lucide-react';
import { ingredientsService, auditLogsService, Ingredient, recipeCostService } from '../lib/database';
import { useApp } from '../context/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { RoleBadge } from './RoleBadge';
import { formatPrice } from '../lib/unitConverter';

import { useSubscriptionGuard } from '../hooks/useSubscriptionGuard';

export const InventoryPage = () => {
  useSubscriptionGuard();
  const { currentUser, setCurrentPage, inventoryFilter, setInventoryFilter } = useApp();
  const { restaurantRole, getPermissionsForContext } = usePermissions();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewContext, setViewContext] = useState<'personal' | 'restaurant'>('personal');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIncreaseModal, setShowIncreaseModal] = useState(false);
  const [showDecreaseModal, setShowDecreaseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantityChange, setQuantityChange] = useState(0);

  const permissions = getPermissionsForContext(viewContext);
  const [newIngredient, setNewIngredient] = useState({
    name: '',
    quantity: 0,
    unit: 'kg',
    minimum_stock: 0,
    price_per_unit: 0,
    category: '',
    supplier: '',
    is_shared: false,
    restaurant_id: null as string | null
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: 0,
    unit: 'kg',
    minimum_stock: 0,
    price_per_unit: 0,
    category: '',
    supplier: ''
  });

  useEffect(() => {
    loadIngredients();
  }, [viewContext]);

  useEffect(() => {
    if (inventoryFilter !== 'All') {
      setFilterStatus(inventoryFilter);
      setInventoryFilter('All');
    }
  }, [inventoryFilter, setInventoryFilter]);

  const loadIngredients = async () => {
    try {
      let data: Ingredient[];
      if (viewContext === 'personal') {
        data = await ingredientsService.getPersonal();
      } else if (viewContext === 'restaurant' && currentUser?.restaurant_id) {
        data = await ingredientsService.getRestaurant(currentUser.restaurant_id);
      } else {
        data = [];
      }
      setIngredients(data);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  };

  const handleAddIngredient = async () => {
    if (newIngredient.price_per_unit < 0) {
      alert('Price cannot be negative');
      return;
    }
    try {
      const ingredientData = {
        ...newIngredient,
        is_shared: viewContext === 'restaurant',
        restaurant_id: viewContext === 'restaurant' ? (currentUser?.restaurant_id || undefined) : undefined
      };
      await ingredientsService.create(ingredientData);
      setShowAddModal(false);
      setNewIngredient({
        name: '',
        quantity: 0,
        unit: 'kg',
        minimum_stock: 0,
        price_per_unit: 0,
        category: '',
        supplier: '',
        is_shared: false,
        restaurant_id: null
      });
      loadIngredients();
    } catch (error) {
      console.error('Error adding ingredient:', error);
    }
  };

  const openIncreaseModal = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setQuantityChange(0);
    setShowIncreaseModal(true);
  };

  const openDecreaseModal = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setQuantityChange(0);
    setShowDecreaseModal(true);
  };

  const openEditModal = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setEditFormData({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      minimum_stock: ingredient.minimum_stock,
      price_per_unit: ingredient.price_per_unit || 0,
      category: ingredient.category || '',
      supplier: ingredient.supplier || ''
    });
    setShowEditModal(true);
  };

  const handleIncreaseQuantity = async () => {
    if (!selectedIngredient || quantityChange <= 0) return;
    try {
      await ingredientsService.adjustQuantity(selectedIngredient.id, quantityChange, 'Added', currentUser?.name || 'User');
      setShowIncreaseModal(false);
      setQuantityChange(0);
      loadIngredients();
    } catch (error) {
      console.error('Error increasing quantity:', error);
    }
  };

  const handleDecreaseQuantity = async () => {
    if (!selectedIngredient || quantityChange <= 0) return;
    if (quantityChange > selectedIngredient.quantity) {
      alert('Cannot decrease by more than current quantity');
      return;
    }
    try {
      await ingredientsService.adjustQuantity(selectedIngredient.id, -quantityChange, 'Removed', currentUser?.name || 'User');
      setShowDecreaseModal(false);
      setQuantityChange(0);
      loadIngredients();
    } catch (error) {
      console.error('Error decreasing quantity:', error);
    }
  };

  const handleEditIngredient = async () => {
    if (!selectedIngredient) return;
    if (editFormData.price_per_unit < 0) {
      alert('Price cannot be negative');
      return;
    }
    try {
      const quantityChanged = editFormData.quantity !== selectedIngredient.quantity;
      const oldQuantity = selectedIngredient.quantity;
      const oldPrice = selectedIngredient.price_per_unit;
      const newPrice = editFormData.price_per_unit;

      await ingredientsService.update(selectedIngredient.id, editFormData);

      if (quantityChanged) {
        const change = editFormData.quantity - oldQuantity;
        const operation = change > 0 ? 'Added' : 'Removed';
        await auditLogsService.create({
          user_id: currentUser?.id || '',
          user_name: currentUser?.name || 'User',
          operation: operation,
          table_name: 'ingredients',
          record_id: selectedIngredient.id,
          old_values: { quantity: oldQuantity, name: selectedIngredient.name },
          new_values: { quantity: editFormData.quantity, name: editFormData.name }
        });
      }

      if (oldPrice !== newPrice) {
        console.log(`Price changed from ${oldPrice} to ${newPrice}, updating recipes...`);
        await recipeCostService.updateRecipesForIngredient(selectedIngredient.id);
      }

      setShowEditModal(false);
      loadIngredients();
    } catch (error) {
      console.error('Error updating ingredient:', error);
    }
  };

  const getStatus = (ingredient: Ingredient) => {
    if (ingredient.quantity >= ingredient.minimum_stock) {
      return { text: 'In Stock', color: 'bg-green-500' };
    }
    return { text: 'Low Stock', color: 'bg-orange-500' };
  };

  const filteredIngredients = ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (ingredient.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const status = getStatus(ingredient);
    const matchesStatus = filterStatus === 'All' ||
                         (filterStatus === 'Low Stock' && status.text === 'Low Stock') ||
                         (filterStatus === 'In Stock' && status.text === 'In Stock');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="relative bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-cyan-50/50"></div>
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-pulse"></div>

          <div className="relative z-10 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-3 rounded-2xl shadow-lg">
                  <Search size={28} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Inventory Overview</h1>
                    {currentUser?.restaurant_id && <RoleBadge role={restaurantRole} size="sm" />}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {permissions.isReadOnly ? 'View ingredients' : 'Manage and track your ingredients'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => setCurrentPage('settings')}
                  className="group p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all duration-300"
                  title="Settings"
                >
                  <Settings size={20} className="text-slate-600 group-hover:text-blue-600 group-hover:rotate-90 transition-all duration-300" />
                </button>
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 border border-slate-200 text-slate-700 rounded-2xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <Home size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                  Home
                </button>
              </div>
            </div>

            {currentUser?.restaurant_id && (
              <div className="mb-6 flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-slate-200 w-fit">
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search ingredients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/80 backdrop-blur-sm border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-400 focus:bg-white shadow-sm hover:shadow-md transition-all duration-300"
                />
              </div>

              <button
                onClick={() => setFilterStatus(filterStatus === 'In Stock' ? 'All' : 'In Stock')}
                className={`px-6 py-3.5 rounded-2xl font-medium transition-all duration-300 shadow-sm hover:shadow-md ${
                  filterStatus === 'In Stock'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/30'
                    : 'bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-700 hover:border-green-400'
                }`}
              >
                In Stock
              </button>

              <button
                onClick={() => setFilterStatus(filterStatus === 'Low Stock' ? 'All' : 'Low Stock')}
                className={`px-6 py-3.5 rounded-2xl font-medium transition-all duration-300 shadow-sm hover:shadow-md ${
                  filterStatus === 'Low Stock'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30'
                    : 'bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-700 hover:border-orange-400'
                }`}
              >
                Low Stock
              </button>

              {permissions.canAddIngredients ? (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="group flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-2xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                  Add Ingredient
                </button>
              ) : (
                <div className="group relative">
                  <button
                    disabled
                    className="flex items-center gap-2 px-6 py-3.5 bg-slate-200 text-slate-400 rounded-2xl font-medium shadow-sm cursor-not-allowed"
                    title="Manager or Supervisor access required"
                  >
                    <Lock size={20} />
                    Add Ingredient
                  </button>
                </div>
              )}
            </div>

            <div className="relative bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-t-2xl p-0.5">
              <div className="bg-white/90 backdrop-blur-sm rounded-t-2xl">
                <div className="h-3 bg-gradient-to-r from-blue-400/20 via-cyan-400/20 to-blue-400/20"></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-b-2xl overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Item Name</th>
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Quantity</th>
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Unit</th>
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Price</th>
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Minimum Stock</th>
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Status</th>
                    <th className="text-left px-6 py-4 font-bold text-slate-800">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((ingredient) => {
                    const status = getStatus(ingredient);
                    return (
                      <tr key={ingredient.id} className="group bg-white/50 backdrop-blur-sm border-b border-slate-200 hover:bg-white hover:shadow-md transition-all duration-300">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{ingredient.name}</span>
                            {ingredient.is_shared ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-md whitespace-nowrap">
                                Restaurant
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-md whitespace-nowrap">
                                Personal
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{ingredient.quantity}</td>
                        <td className="px-6 py-4 text-slate-600">{ingredient.unit}</td>
                        <td className="px-6 py-4">
                          {ingredient.price_per_unit > 0 ? (
                            <span className="text-blue-600 font-semibold">
                              {formatPrice(ingredient.price_per_unit, ingredient.unit)}
                            </span>
                          ) : (
                            <span className="text-orange-500 text-sm">⚠️ No price</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{ingredient.minimum_stock}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 ${status.color} text-white rounded-full text-sm font-semibold whitespace-nowrap shadow-md`}>
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                            {status.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {permissions.isReadOnly ? (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Eye size={16} />
                                <span className="text-xs font-medium">View Only</span>
                              </div>
                            ) : (
                              <>
                                {permissions.canEditIngredients && (
                                  <>
                                    <button
                                      onClick={() => openIncreaseModal(ingredient)}
                                      className="group/btn p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-110"
                                      title="Increase quantity"
                                    >
                                      <Plus size={16} className="group-hover/btn:rotate-90 transition-transform" />
                                    </button>
                                    <button
                                      onClick={() => openDecreaseModal(ingredient)}
                                      className="group/btn p-2.5 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-110"
                                      title="Decrease quantity"
                                    >
                                      <Minus size={16} className="group-hover/btn:rotate-90 transition-transform" />
                                    </button>
                                    <button
                                      onClick={() => openEditModal(ingredient)}
                                      className="group/btn p-2.5 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl hover:from-cyan-600 hover:to-cyan-700 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-110"
                                      title="Edit ingredient"
                                    >
                                      <Edit2 size={16} className="group-hover/btn:rotate-12 transition-transform" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showIncreaseModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-cyan-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Increase Quantity</h2>
            <p className="text-gray-600 mb-6">{selectedIngredient.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Add</label>
                <input
                  type="number"
                  min="0"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  placeholder="Enter quantity"
                />
              </div>
              <p className="text-sm text-gray-500">
                Current: {selectedIngredient.quantity} {selectedIngredient.unit}
              </p>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowIncreaseModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIncreaseQuantity}
                  disabled={quantityChange <= 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDecreaseModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-red-50/30 via-transparent to-orange-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Decrease Quantity</h2>
            <p className="text-gray-600 mb-6">{selectedIngredient.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Remove</label>
                <input
                  type="number"
                  min="0"
                  max={selectedIngredient.quantity}
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  placeholder="Enter quantity"
                />
              </div>
              <p className="text-sm text-gray-500">
                Current: {selectedIngredient.quantity} {selectedIngredient.unit}
              </p>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowDecreaseModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecreaseQuantity}
                  disabled={quantityChange <= 0 || quantityChange > selectedIngredient.quantity}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-medium shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/30 via-transparent to-blue-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Ingredient</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    value={editFormData.quantity}
                    onChange={(e) => setEditFormData({ ...editFormData, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <input
                    type="text"
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock</label>
                <input
                  type="number"
                  value={editFormData.minimum_stock}
                  onChange={(e) => setEditFormData({ ...editFormData, minimum_stock: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category (Optional)</label>
                <input
                  type="text"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier (Optional)</label>
                <input
                  type="text"
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price Per Unit (lei/{editFormData.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.price_per_unit}
                  onChange={(e) => setEditFormData({ 
                    ...editFormData, 
                    price_per_unit: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  placeholder="Enter price (e.g., 4.50)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Price in lei per {editFormData.unit}
                </p>
              </div>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditIngredient}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 transition-all duration-300"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-cyan-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Ingredient</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newIngredient.name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <input
                    type="text"
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Stock</label>
                <input
                  type="number"
                  value={newIngredient.minimum_stock}
                  onChange={(e) => setNewIngredient({ ...newIngredient, minimum_stock: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier (Optional)</label>
                <input
                  type="text"
                  value={newIngredient.supplier}
                  onChange={(e) => setNewIngredient({ ...newIngredient, supplier: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price Per Unit (lei/{newIngredient.unit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newIngredient.price_per_unit}
                  onChange={(e) => setNewIngredient({ 
                    ...newIngredient, 
                    price_per_unit: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400"
                  placeholder="Enter price (e.g., 4.50)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Price in lei per {newIngredient.unit}
                </p>
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
                  onClick={handleAddIngredient}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300"
                >
                  Add Ingredient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
