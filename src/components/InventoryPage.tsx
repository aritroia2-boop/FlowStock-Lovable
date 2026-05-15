import { useState, useEffect } from 'react';
import { Search, Plus, Minus, Edit2, User, Building2, Eye, Lock, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { ingredientsService, auditLogsService, Ingredient, recipeCostService, inventoryBatchesService, InventoryBatch } from '../lib/database';
import { useApp } from '../context/AppContext';
import { usePermissions } from '../hooks/usePermissions';
import { RoleBadge } from './RoleBadge';

import { AppLayout } from './AppLayout';

import { useSubscriptionGuard } from '../hooks/useSubscriptionGuard';
import { PersonalPaywall } from './PersonalPaywall';

export const InventoryPage = () => {
  useSubscriptionGuard();
  const { currentUser, setCurrentPage, inventoryFilter, setInventoryFilter, isAdmin, subscriptionSource } = useApp();
  const { restaurantRole, getPermissionsForContext } = usePermissions();
  const canUsePersonal = isAdmin || subscriptionSource === 'self';
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewContext, setViewContext] = useState<'personal' | 'restaurant'>(
    canUsePersonal ? 'personal' : 'restaurant'
  );
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
      let batchData: InventoryBatch[];
      if (viewContext === 'personal') {
        data = await ingredientsService.getPersonal();
        batchData = await inventoryBatchesService.getPersonal();
      } else if (viewContext === 'restaurant' && currentUser?.restaurant_id) {
        data = await ingredientsService.getRestaurant(currentUser.restaurant_id);
        batchData = await inventoryBatchesService.getRestaurant(currentUser.restaurant_id);
      } else {
        data = [];
        batchData = [];
      }
      setIngredients(data);
      setBatches(batchData);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const batchesFor = (ingredientId: string) =>
    batches.filter(b => b.ingredient_id === ingredientId)
      .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

  const totalRemaining = (ingredientId: string) =>
    batchesFor(ingredientId).reduce((sum, b) => sum + Number(b.remaining_quantity || 0), 0);

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
      // Manual stock-in creates a batch using the ingredient's standard price
      await inventoryBatchesService.create({
        ingredient_id: selectedIngredient.id,
        quantity: quantityChange,
        remaining_quantity: quantityChange,
        unit: selectedIngredient.unit,
        purchase_price: (selectedIngredient as any).standard_price || selectedIngredient.price_per_unit || 0,
        currency: 'RON',
        owner_id: currentUser?.id,
        restaurant_id: selectedIngredient.restaurant_id || undefined,
        attributes: (selectedIngredient as any).attributes || {},
        supplier: 'Manual',
      } as any);
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
    const available = totalRemaining(selectedIngredient.id);
    if (quantityChange > available) {
      alert(`Cannot use more than current stock (${available} ${selectedIngredient.unit})`);
      return;
    }
    try {
      await inventoryBatchesService.consume(selectedIngredient.id, quantityChange, 'Used');
      setShowDecreaseModal(false);
      setQuantityChange(0);
      loadIngredients();
    } catch (error) {
      console.error('Error using ingredient:', error);
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
    <AppLayout>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 p-3 sm:p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="relative bg-card/70 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-cyan-50/50 dark:from-blue-900/10 dark:to-cyan-900/10"></div>
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-pulse"></div>

          <div className="relative z-10 p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5 md:mb-8">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-2.5 md:p-3 rounded-2xl shadow-lg">
                  <Search size={22} className="text-white md:hidden" />
                  <Search size={28} className="text-white hidden md:block" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Inventory</h1>
                    {currentUser?.restaurant_id && <RoleBadge role={restaurantRole} size="sm" />}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 md:mt-1">
                    {permissions.isReadOnly ? 'View ingredients' : 'Manage and track your ingredients'}
                  </p>
                </div>
              </div>
            </div>

            {currentUser?.restaurant_id && (
              <div className="mb-6 flex items-center gap-3 bg-card/60 backdrop-blur-sm rounded-2xl p-2 border border-border w-fit">
                <button
                  onClick={() => setViewContext('personal')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                    viewContext === 'personal'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                      : 'text-muted-foreground hover:bg-muted'
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
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Building2 size={18} />
                  Restaurant
                </button>
              </div>
            )}

            {viewContext === 'personal' && !canUsePersonal ? (
              <PersonalPaywall feature="Personal" />
            ) : (
            <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search ingredients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-card/80 backdrop-blur-sm border-2 border-border rounded-2xl focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground shadow-sm hover:shadow-md transition-all duration-300"
                />
              </div>

              <button
                onClick={() => setFilterStatus(filterStatus === 'In Stock' ? 'All' : 'In Stock')}
                className={`px-6 py-3.5 rounded-2xl font-medium transition-all duration-300 shadow-sm hover:shadow-md ${
                  filterStatus === 'In Stock'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/30'
                    : 'bg-card/80 backdrop-blur-sm border-2 border-border text-foreground hover:border-green-400'
                }`}
              >
                In Stock
              </button>

              <button
                onClick={() => setFilterStatus(filterStatus === 'Low Stock' ? 'All' : 'Low Stock')}
                className={`px-6 py-3.5 rounded-2xl font-medium transition-all duration-300 shadow-sm hover:shadow-md ${
                  filterStatus === 'Low Stock'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30'
                    : 'bg-card/80 backdrop-blur-sm border-2 border-border text-foreground hover:border-orange-400'
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
                    className="flex items-center gap-2 px-6 py-3.5 bg-muted text-muted-foreground rounded-2xl font-medium shadow-sm cursor-not-allowed"
                    title="Manager or Supervisor access required"
                  >
                    <Lock size={20} />
                    Add Ingredient
                  </button>
                </div>
              )}
            </div>

            <div className="relative bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-t-2xl p-0.5">
              <div className="bg-card/90 backdrop-blur-sm rounded-t-2xl">
                <div className="h-3 bg-gradient-to-r from-blue-400/20 via-cyan-400/20 to-blue-400/20"></div>
              </div>
            </div>

            {/* Grouped product list with expandable batches (FIFO order) */}
            <div className="space-y-3 mt-2">
              {filteredIngredients.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10">
                  No ingredients found.
                </div>
              )}
              {filteredIngredients.map((ingredient) => {
                const ingBatches = batchesFor(ingredient.id);
                const totalQty = totalRemaining(ingredient.id);
                const computedStatus = totalQty >= ingredient.minimum_stock
                  ? { text: 'In Stock', color: 'bg-green-500' }
                  : { text: 'Low Stock', color: 'bg-orange-500' };
                const isOpen = expanded.has(ingredient.id);
                const firstActiveBatchId = ingBatches.find(b => Number(b.remaining_quantity) > 0)?.id;

                return (
                  <div key={ingredient.id} className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm overflow-hidden">
                    {/* Product header row */}
                    <div className="flex items-center gap-3 p-4">
                      <button
                        onClick={() => toggleExpanded(ingredient.id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>

                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-2 rounded-xl shrink-0">
                        <Package size={20} className="text-blue-600 dark:text-blue-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">{ingredient.name}</h3>
                          {ingredient.category && (
                            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-medium rounded-md">
                              {ingredient.category}
                            </span>
                          )}
                          {ingredient.is_shared ? (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-medium rounded-md">
                              Restaurant
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-medium rounded-md">
                              Personal
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {ingBatches.length} batch{ingBatches.length === 1 ? '' : 'es'} · Min: {ingredient.minimum_stock} {ingredient.unit}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
                          {totalQty} <span className="text-sm font-normal text-muted-foreground">{ingredient.unit}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${computedStatus.color} text-white rounded-full text-[10px] font-semibold mt-1`}>
                          <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                          {computedStatus.text}
                        </span>
                      </div>

                      {!permissions.isReadOnly && permissions.canEditIngredients && (
                        <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            onClick={() => openIncreaseModal(ingredient)}
                            className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition"
                            title="Add stock (new batch)"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => openDecreaseModal(ingredient)}
                            className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/20 transition"
                            title="Use (FIFO)"
                          >
                            <Minus size={16} />
                          </button>
                          <button
                            onClick={() => openEditModal(ingredient)}
                            className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition"
                            title="Edit product"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mobile actions */}
                    {!permissions.isReadOnly && permissions.canEditIngredients && (
                      <div className="md:hidden grid grid-cols-3 gap-2 px-4 pb-3">
                        <button
                          onClick={() => openIncreaseModal(ingredient)}
                          className="flex items-center justify-center gap-1 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-medium"
                        >
                          <Plus size={14} /> Add
                        </button>
                        <button
                          onClick={() => openDecreaseModal(ingredient)}
                          className="flex items-center justify-center gap-1 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium"
                        >
                          <Minus size={14} /> Use
                        </button>
                        <button
                          onClick={() => openEditModal(ingredient)}
                          className="flex items-center justify-center gap-1 py-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl text-xs font-medium"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      </div>
                    )}
                    {permissions.isReadOnly && (
                      <div className="flex items-center gap-2 text-muted-foreground px-4 pb-3 md:hidden">
                        <Eye size={14} />
                        <span className="text-xs font-medium">View Only</span>
                      </div>
                    )}

                    {/* Expanded batches */}
                    {isOpen && (
                      <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                        {ingBatches.length === 0 ? (
                          <div className="text-center text-xs text-muted-foreground py-4">
                            No batches yet. Stock will appear here once invoices are confirmed or stock is added.
                          </div>
                        ) : (
                          ingBatches.map((batch) => {
                            const attrs = (batch.attributes || {}) as Record<string, any>;
                            const attrEntries = Object.entries(attrs).filter(([, v]) => v !== null && v !== '' && v !== undefined);
                            const purchased = Number(batch.quantity || 0);
                            const remaining = Number(batch.remaining_quantity || 0);
                            const pct = purchased > 0 ? Math.max(0, Math.min(100, (remaining / purchased) * 100)) : 0;
                            const isDepleted = remaining <= 0;
                            const isNext = batch.id === firstActiveBatchId;
                            const date = new Date(batch.received_at).toLocaleDateString();

                            return (
                              <div
                                key={batch.id}
                                className={`bg-card border border-border rounded-xl p-3 ${isDepleted ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {isNext && (
                                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-semibold rounded-md uppercase tracking-wide">
                                          Next to use
                                        </span>
                                      )}
                                      {isDepleted && (
                                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-semibold rounded-md uppercase tracking-wide">
                                          Depleted
                                        </span>
                                      )}
                                      {attrEntries.length > 0 ? (
                                        attrEntries.map(([k, v]) => (
                                          <span key={k} className="px-2 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-medium rounded-md">
                                            {k.replace(/_/g, ' ')}: {String(v)}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground">No attributes</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1.5">
                                      {batch.supplier ? `${batch.supplier} · ` : ''}{date}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="text-sm font-semibold text-foreground tabular-nums">
                                      {remaining} / {purchased} {batch.unit}
                                    </div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium tabular-nums">
                                      {Number(batch.purchase_price).toFixed(2)} {batch.currency || 'RON'}/{batch.unit}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${isDepleted ? 'bg-muted-foreground/30' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            )}
          </div>
        </div>
      </div>

      {showIncreaseModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-card/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-border overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-cyan-50/30 dark:from-blue-900/10 dark:to-cyan-900/10 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">Increase Quantity</h2>
            <p className="text-muted-foreground mb-6">{selectedIngredient.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Amount to Add</label>
                <input
                  type="number"
                  min="0"
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-xl focus:outline-none focus:border-primary"
                  placeholder="Enter quantity"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Current: {selectedIngredient.quantity} {selectedIngredient.unit}
              </p>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowIncreaseModal(false)}
                  className="flex-1 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
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
          <div className="relative bg-card/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-border overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-red-50/30 via-transparent to-orange-50/30 dark:from-red-900/10 dark:to-orange-900/10 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">Use Ingredient</h2>
            <p className="text-muted-foreground mb-6">{selectedIngredient.name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Amount to Use</label>
                <input
                  type="number"
                  min="0"
                  max={selectedIngredient.quantity}
                  value={quantityChange}
                  onChange={(e) => setQuantityChange(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-xl focus:outline-none focus:border-primary"
                  placeholder="Enter quantity"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Current: {selectedIngredient.quantity} {selectedIngredient.unit}
              </p>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowDecreaseModal(false)}
                  className="flex-1 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecreaseQuantity}
                  disabled={quantityChange <= 0 || quantityChange > selectedIngredient.quantity}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-medium shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Use
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative bg-card/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-border overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/30 via-transparent to-blue-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-6">Edit Ingredient</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Quantity</label>
                  <input
                    type="number"
                    value={editFormData.quantity}
                    onChange={(e) => setEditFormData({ ...editFormData, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Unit</label>
                  <input
                    type="text"
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Minimum Stock</label>
                <input
                  type="number"
                  value={editFormData.minimum_stock}
                  onChange={(e) => setEditFormData({ ...editFormData, minimum_stock: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Category (Optional)</label>
                <input
                  type="text"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Supplier (Optional)</label>
                <input
                  type="text"
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
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
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                  placeholder="Enter price (e.g., 4.50)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Price in lei per {editFormData.unit}
                </p>
              </div>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 bg-muted hover:bg-muted text-foreground rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
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
          <div className="relative bg-card/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-border overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-cyan-50/30 pointer-events-none"></div>
            <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-6">Add New Ingredient</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input
                  type="text"
                  value={newIngredient.name}
                  onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Quantity</label>
                  <input
                    type="number"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Unit</label>
                  <input
                    type="text"
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Minimum Stock</label>
                <input
                  type="number"
                  value={newIngredient.minimum_stock}
                  onChange={(e) => setNewIngredient({ ...newIngredient, minimum_stock: Number(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Supplier (Optional)</label>
                <input
                  type="text"
                  value={newIngredient.supplier}
                  onChange={(e) => setNewIngredient({ ...newIngredient, supplier: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
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
                  className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
                  placeholder="Enter price (e.g., 4.50)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Price in lei per {newIngredient.unit}
                </p>
              </div>
            </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 bg-muted hover:bg-muted text-foreground rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-300"
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
    </AppLayout>
  );
};
