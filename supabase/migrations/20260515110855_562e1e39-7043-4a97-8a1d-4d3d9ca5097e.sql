ALTER TABLE inventory_batches
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier text;

CREATE INDEX IF NOT EXISTS idx_batches_ingredient_fifo
  ON inventory_batches (ingredient_id, received_at, created_at)
  WHERE remaining_quantity > 0;

-- Seed legacy batches for ingredients that have stock but no batches yet
INSERT INTO inventory_batches (
  ingredient_id, quantity, remaining_quantity, unit, purchase_price, currency,
  received_at, owner_id, restaurant_id, supplier, attributes
)
SELECT
  i.id, i.quantity, i.quantity, i.unit, COALESCE(i.price_per_unit, 0), 'RON',
  COALESCE(i.updated_at, now()), i.owner_id, i.restaurant_id, i.supplier,
  COALESCE(i.attributes, '{}'::jsonb)
FROM ingredients i
WHERE i.quantity > 0
  AND NOT EXISTS (SELECT 1 FROM inventory_batches b WHERE b.ingredient_id = i.id);

CREATE OR REPLACE FUNCTION public.consume_ingredient(
  p_ingredient_id uuid,
  p_quantity numeric,
  p_reason text DEFAULT 'consumption',
  p_recipe_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_quantity;
  v_batch record;
  v_taken numeric;
  v_consumed jsonb := '[]'::jsonb;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_ingredient_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT name INTO v_user_name FROM profiles WHERE id = v_user_id;
  SELECT name INTO v_ingredient_name FROM ingredients WHERE id = p_ingredient_id;

  FOR v_batch IN
    SELECT id, remaining_quantity, purchase_price
    FROM inventory_batches
    WHERE ingredient_id = p_ingredient_id AND remaining_quantity > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_taken := LEAST(v_batch.remaining_quantity, v_remaining);
    UPDATE inventory_batches
      SET remaining_quantity = remaining_quantity - v_taken
      WHERE id = v_batch.id;
    v_consumed := v_consumed || jsonb_build_object(
      'batch_id', v_batch.id, 'quantity', v_taken, 'unit_price', v_batch.purchase_price
    );
    v_remaining := v_remaining - v_taken;
  END LOOP;

  UPDATE ingredients
    SET quantity = COALESCE(
      (SELECT SUM(remaining_quantity) FROM inventory_batches WHERE ingredient_id = p_ingredient_id), 0
    ),
    updated_at = now()
    WHERE id = p_ingredient_id;

  INSERT INTO audit_logs (user_id, user_name, operation, table_name, record_id, new_values)
  VALUES (
    v_user_id,
    COALESCE(v_user_name, 'User'),
    p_reason,
    'inventory_batches',
    p_ingredient_id,
    jsonb_build_object(
      'ingredient_name', v_ingredient_name,
      'requested', p_quantity,
      'fulfilled', p_quantity - v_remaining,
      'shortfall', GREATEST(v_remaining, 0),
      'recipe_id', p_recipe_id,
      'batches', v_consumed
    )
  );

  RETURN jsonb_build_object(
    'requested', p_quantity,
    'fulfilled', p_quantity - v_remaining,
    'shortfall', GREATEST(v_remaining, 0),
    'batches', v_consumed
  );
END $$;