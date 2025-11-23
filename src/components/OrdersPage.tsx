import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Upload, FileText, Loader2, Check, X, AlertCircle, Trash2, Eye, ChevronDown } from 'lucide-react';
import { ordersService, orderItemsService, ingredientsService } from '../lib/database';
import { uploadOrderInvoice, deleteOrderInvoice } from '../lib/supabase';
import type { Order, OrderItem, Ingredient } from '../lib/supabase';
import { matchIngredients } from '../lib/ingredientMatcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MatchedItem extends OrderItem {
  matchedIngredient: Ingredient | null;
  confidence: number;
  extractedName: string;
}

export function OrdersPage() {
  const { currentUser, setCurrentPage } = useApp();
  const [context, setContext] = useState<'personal' | 'restaurant'>('personal');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<MatchedItem[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadOrders();
    loadIngredients();

    // Subscribe to order updates
    const ordersSubscription = supabase
      .channel('orders_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      ordersSubscription.unsubscribe();
    };
  }, [context, currentUser]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      let data: Order[];
      
      if (context === 'restaurant' && currentUser?.restaurant_id) {
        data = await ordersService.getRestaurant(currentUser.restaurant_id);
      } else {
        data = await ordersService.getPersonal();
      }
      
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadIngredients = async () => {
    try {
      if (context === 'restaurant' && currentUser?.restaurant_id) {
        const data = await ingredientsService.getRestaurant(currentUser.restaurant_id);
        setAllIngredients(data);
      } else {
        const data = await ingredientsService.getPersonal();
        setAllIngredients(data);
      }
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploading(true);
      
      // Upload PDF to storage
      const fileUrl = await uploadOrderInvoice(file, currentUser.id);

      // Create order record
      await ordersService.create({
        user_id: currentUser.id,
        restaurant_id: context === 'restaurant' ? currentUser.restaurant_id : null,
        file_name: file.name,
        file_url: fileUrl,
        status: 'pending'
      });

      toast.success('Invoice uploaded successfully');
      loadOrders();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload invoice');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleProcessInvoice = async (order: Order) => {
    if (!currentUser) return;

    try {
      setProcessingId(order.id);
      toast.info('Processing invoice... This may take a moment');

      const { error } = await supabase.functions.invoke('process-invoice', {
        body: { fileUrl: order.file_url, orderId: order.id }
      });

      if (error) throw error;

      toast.success('Invoice processed successfully');
      loadOrders();
    } catch (error) {
      console.error('Error processing invoice:', error);
      toast.error('Failed to process invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDetails = async (order: Order) => {
    try {
      setSelectedOrder(order);
      
      const items = await orderItemsService.getByOrderId(order.id);
      
      // Match ingredients with inventory
      const matched = matchIngredients(
        items.map(item => ({
          name: item.ingredient_name,
          quantity: item.quantity,
          unit: item.unit,
          price_per_unit: item.price_per_unit
        })),
        allIngredients
      );

      const matchedItems: MatchedItem[] = items.map((item, index) => ({
        ...item,
        ...matched[index]
      }));

      setOrderItems(matchedItems);
      setShowConfirmModal(true);
    } catch (error) {
      console.error('Error loading order details:', error);
      toast.error('Failed to load order details');
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    try {
      await deleteOrderInvoice(order.file_url);
      await ordersService.delete(order.id);
      toast.success('Order deleted successfully');
      loadOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const handleUpdateMatch = (index: number, ingredientId: string | null, isNew: boolean) => {
    const updatedItems = [...orderItems];
    const matchedIngredient = ingredientId 
      ? allIngredients.find(ing => ing.id === ingredientId) || null
      : null;
    
    updatedItems[index] = {
      ...updatedItems[index],
      matchedIngredient,
      matched_ingredient_id: ingredientId || undefined,
      is_new_ingredient: isNew,
      needs_confirmation: !matchedIngredient && !isNew
    };
    
    setOrderItems(updatedItems);
  };

  const handleConfirmOrder = async () => {
    if (!currentUser || !selectedOrder) return;

    try {
      setConfirming(true);

      for (const item of orderItems) {
        if (item.is_new_ingredient) {
          // Create new ingredient
          await ingredientsService.create({
            name: item.ingredient_name,
            quantity: item.quantity,
            unit: item.unit,
            price_per_unit: item.price_per_unit,
            minimum_stock: 0,
            owner_id: currentUser.id,
            restaurant_id: context === 'restaurant' ? currentUser.restaurant_id : null,
            is_shared: context === 'restaurant'
          });
        } else if (item.matchedIngredient) {
          // Update existing ingredient quantity
          await ingredientsService.adjustQuantity(
            item.matchedIngredient.id,
            item.quantity,
            `Added from invoice: ${selectedOrder.file_name}`,
            currentUser.name
          );

          // Update price if provided
          if (item.price_per_unit > 0) {
            await ingredientsService.update(item.matchedIngredient.id, {
              price_per_unit: item.price_per_unit
            });
          }
        }
      }

      toast.success('Inventory updated successfully');
      setShowConfirmModal(false);
      setSelectedOrder(null);
      setOrderItems([]);
      loadOrders();
      loadIngredients();
    } catch (error) {
      console.error('Error confirming order:', error);
      toast.error('Failed to update inventory');
    } finally {
      setConfirming(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'processing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'processed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <AlertCircle size={14} />;
      case 'processing': return <Loader2 size={14} className="animate-spin" />;
      case 'processed': return <Check size={14} />;
      case 'error': return <X size={14} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border/40 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="p-2 hover:bg-background/50 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-foreground" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Orders</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload and process supplier invoices
                </p>
              </div>
            </div>

            {/* Context Toggle */}
            <div className="flex gap-2 bg-background/50 backdrop-blur-sm p-1 rounded-lg border border-border/40">
              <button
                onClick={() => setContext('personal')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${
                  context === 'personal'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => setContext('restaurant')}
                disabled={!currentUser?.restaurant_id}
                className={`px-4 py-2 rounded-md font-medium transition-all ${
                  context === 'restaurant'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                Restaurant
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="mb-8">
          <div className="bg-card border border-border/40 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Upload Invoice</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload PDF invoices from suppliers to extract ingredients
                </p>
              </div>
            </div>

            <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <Upload size={32} className="text-muted-foreground group-hover:text-primary transition-colors mb-2" />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">PDF files up to 10MB</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Orders List */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Uploaded Invoices</h2>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-xl p-12 text-center backdrop-blur-sm">
              <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-1">No invoices uploaded yet</p>
              <p className="text-sm text-muted-foreground">
                Upload your first supplier invoice to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-card border border-border/40 rounded-xl p-6 backdrop-blur-sm hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <FileText size={24} className="text-primary" />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">
                          {order.file_name}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>
                            {new Date(order.created_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          
                          {order.supplier && (
                            <>
                              <span>•</span>
                              <span className="text-foreground font-medium">{order.supplier}</span>
                            </>
                          )}
                        </div>

                        {order.error_message && (
                          <div className="mt-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                            {order.error_message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      {/* Status Badge */}
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="capitalize">{order.status}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleProcessInvoice(order)}
                            disabled={processingId === order.id}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {processingId === order.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              'Process'
                            )}
                          </button>
                        )}

                        {order.status === 'processed' && (
                          <button
                            onClick={() => handleViewDetails(order)}
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                          >
                            <Eye size={18} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteOrder(order)}
                          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedOrder && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border/40 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="border-b border-border/40 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Confirm Order Items</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selectedOrder.file_name}</p>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                >
                  <X size={20} className="text-foreground" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={item.id} className="bg-background/50 border border-border/40 rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Extracted Name */}
                      <div className="col-span-3">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          Extracted Name
                        </label>
                        <p className="text-sm font-medium text-foreground">{item.ingredient_name}</p>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[index].quantity = parseFloat(e.target.value) || 0;
                            setOrderItems(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-background border border-border/40 rounded-lg text-sm text-foreground"
                        />
                      </div>

                      {/* Unit */}
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[index].unit = e.target.value;
                            setOrderItems(updated);
                          }}
                          className="w-full px-3 py-1.5 bg-background border border-border/40 rounded-lg text-sm text-foreground"
                        />
                      </div>

                      {/* Match Ingredient */}
                      <div className="col-span-4">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          Match with Ingredient
                        </label>
                        <div className="relative">
                          <select
                            value={item.is_new_ingredient ? 'NEW' : (item.matched_ingredient_id || '')}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'NEW') {
                                handleUpdateMatch(index, null, true);
                              } else {
                                handleUpdateMatch(index, value, false);
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-background border border-border/40 rounded-lg text-sm text-foreground appearance-none pr-8"
                          >
                            <option value="">Select ingredient...</option>
                            <option value="NEW" className="font-semibold">+ Create New Ingredient</option>
                            <option disabled>────────────</option>
                            {allIngredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.quantity} {ing.unit})
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>

                      {/* Confidence Badge */}
                      <div className="col-span-1 flex justify-end">
                        {item.confidence > 0 && (
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            item.confidence >= 0.9 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            {Math.round(item.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border/40 p-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-6 py-2.5 border border-border/40 rounded-lg hover:bg-background/50 transition-colors text-foreground font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={confirming}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {confirming ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Confirm & Update Inventory
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
