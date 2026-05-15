-- Invoice processing v2: attributes, separate invoice price vs standard price, inventory batches

-- 1. Ingredients: add reference price, last purchase price, attributes
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS standard_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_purchase_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb;

-- Seed standard_price from existing price_per_unit so legacy rows have a baseline
UPDATE public.ingredients
SET standard_price = price_per_unit
WHERE standard_price = 0 AND price_per_unit > 0;

-- 2. Order items: richer extraction output
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_price_line numeric,
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS invoice_unit_price numeric;

-- 3. Orders: invoice date
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_date date;

-- 4. Inventory batches table for per-delivery cost
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL,
  order_id uuid,
  quantity numeric NOT NULL,
  remaining_quantity numeric NOT NULL,
  unit text NOT NULL,
  purchase_price numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'RON',
  received_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid,
  restaurant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_batches_ingredient_idx ON public.inventory_batches(ingredient_id);
CREATE INDEX IF NOT EXISTS inventory_batches_restaurant_idx ON public.inventory_batches(restaurant_id);
CREATE INDEX IF NOT EXISTS inventory_batches_owner_idx ON public.inventory_batches(owner_id);

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batch_select_personal ON public.inventory_batches
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY batch_select_restaurant ON public.inventory_batches
  FOR SELECT TO authenticated
  USING (restaurant_id IS NOT NULL AND restaurant_id = public.get_my_restaurant_id());

CREATE POLICY batch_insert ON public.inventory_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (restaurant_id IS NULL OR public.i_own_restaurant(restaurant_id) OR restaurant_id = public.get_my_restaurant_id())
  );

CREATE POLICY batch_update_personal ON public.inventory_batches
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL)
  WITH CHECK (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY batch_update_restaurant ON public.inventory_batches
  FOR UPDATE TO authenticated
  USING (restaurant_id IS NOT NULL AND public.i_own_restaurant(restaurant_id))
  WITH CHECK (restaurant_id IS NOT NULL AND public.i_own_restaurant(restaurant_id));

CREATE POLICY batch_delete_personal ON public.inventory_batches
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY batch_delete_restaurant ON public.inventory_batches
  FOR DELETE TO authenticated
  USING (restaurant_id IS NOT NULL AND public.i_own_restaurant(restaurant_id));