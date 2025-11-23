-- Create orders table for storing invoice data
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  supplier text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'error')),
  error_message text,
  extracted_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_items table for storing extracted ingredients
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  price_per_unit numeric DEFAULT 0,
  matched_ingredient_id uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  needs_confirmation boolean DEFAULT true,
  is_new_ingredient boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view restaurant orders"
  ON orders FOR SELECT
  USING (restaurant_id IS NOT NULL AND restaurant_id = get_my_restaurant_id());

CREATE POLICY "Users can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own orders"
  ON orders FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for order_items
CREATE POLICY "Users can view order items for their orders"
  ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR orders.restaurant_id = get_my_restaurant_id())
  ));

CREATE POLICY "Users can insert order items for their orders"
  ON order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can update order items for their orders"
  ON order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete order items for their orders"
  ON order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  ));

-- Create storage bucket for order invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-invoices', 'order-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own invoices"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-invoices' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own invoices"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-invoices' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own invoices"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'order-invoices' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add comments
COMMENT ON TABLE orders IS 'Stores supplier invoices and their processing status';
COMMENT ON TABLE order_items IS 'Stores extracted ingredients from invoices';