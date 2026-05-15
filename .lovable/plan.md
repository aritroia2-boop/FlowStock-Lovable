## Goal

Convert the Inventory page and stock-consumption logic from a single aggregated `quantity` model to a **batch-based FIFO model** while keeping each ingredient (product) as the grouping entity.

## 1. UI — Inventory grouped by product, expandable batches

Rebuild the Inventory list (both desktop table and mobile cards) so each row represents a **product** (ingredient) with:

- Product name + category badge
- Total remaining quantity = `Σ batch.remaining_quantity` (computed, not stored)
- Status (In Stock / Low Stock) based on total vs `minimum_stock`
- Chevron / expand button

When expanded, render a nested list of **batches** for that product, ordered by `received_at ASC` (oldest first = FIFO order):

```text
▼ Milk (Lapte) — 24 L total
   ├─ Batch · 4.5% fat · Brand X · 1L bottle
   │   Purchased 10 L · Remaining 4 L · 6.00 RON/L · 2026-05-10 · Supplier: Metro
   ├─ Batch · 3.5% fat · Brand Y
   │   Purchased 20 L · Remaining 20 L · 5.50 RON/L · 2026-05-12 · Supplier: Selgros
```

Each batch row shows:
- Attribute chips from `inventory_batches` (read from joined `order_items.attributes` or `ingredients.attributes` snapshot — see Technical)
- Quantity purchased / remaining (with progress bar)
- Unit purchase price + currency (from invoice, never standard price)
- Invoice date (`orders.invoice_date` fallback `received_at`)
- Supplier (from `orders.supplier`)
- Link "View invoice" → opens the originating order

Batch rows must visually emphasize that the **oldest** batch will be consumed first (badge "Next to use" on first row with remaining > 0).

## 2. Batch model (already present, small additions)

Schema already has `inventory_batches(ingredient_id, order_id, quantity, remaining_quantity, unit, purchase_price, currency, received_at, restaurant_id, owner_id)`.

Add to `inventory_batches`:
- `attributes jsonb default '{}'` — snapshot of attributes at purchase time (fat %, brand, packaging) so batches with different attributes under the same product remain visually distinct and never merge.
- `supplier text` — denormalized for fast UI display.
- index on `(ingredient_id, received_at)` for FIFO queries.

Update `process-invoice` / Orders confirmation flow so that when a batch row is created, `attributes` and `supplier` are copied from `order_items` / `orders` into the batch.

## 3. FIFO consumption logic

Add a Postgres RPC `consume_ingredient(p_ingredient_id uuid, p_quantity numeric, p_unit text, p_reason text, p_recipe_id uuid)` (SECURITY DEFINER) that:

1. Locks batches for the ingredient (`FOR UPDATE`) ordered by `received_at ASC, created_at ASC`.
2. Walks them, deducting from `remaining_quantity` until `p_quantity` reaches 0.
3. Skips batches with `remaining_quantity = 0`.
4. Raises if total available < required (or returns `{ shortfall: X }` so UI can warn).
5. Inserts an `audit_logs` row per batch consumed (batch id, qty taken, price at consumption).
6. Recomputes `ingredients.quantity = Σ remaining_quantity` and `ingredients.last_purchase_price = price of newest batch with stock > 0` for backwards compatibility.

Replace existing `ingredientsService.adjustQuantity(id, -X, ...)` calls for **consumption** with calls to this RPC. Manual "Add" / "Remove" on the inventory page (when not from an invoice) keeps working but:
- "Add" creates a manual batch (`order_id = null`, `purchase_price = ingredient.standard_price`, `attributes = {}`, supplier = "Manual").
- "Remove" calls FIFO consume.

Recipe usage (wherever recipes deduct stock) and the Decrease modal in InventoryPage both route through `consume_ingredient`.

## 4. Matching & attribute preservation

No change to product matching itself, but enforce at write-time:
- When confirming an order item, never overwrite an existing batch — always insert a new one.
- Attribute mismatch between invoice line and target ingredient is allowed (batches differ); attributes are stored on the batch, not flattened into the ingredient.
- `ingredients.standard_price` is never updated automatically by invoice processing (already the case — keep).

## 5. Out of scope

- No changes to auth, roles, subscriptions, employee paywall.
- No changes to Audit log UI, dark-mode tweaks, or invoice extraction prompt.
- Recipe page UI stays the same — only the underlying deduction call changes.

## Technical details

**Migration (single file):**
```sql
ALTER TABLE inventory_batches
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supplier text;
CREATE INDEX IF NOT EXISTS idx_batches_ingredient_fifo
  ON inventory_batches (ingredient_id, received_at, created_at)
  WHERE remaining_quantity > 0;

CREATE OR REPLACE FUNCTION public.consume_ingredient(
  p_ingredient_id uuid, p_quantity numeric, p_reason text, p_recipe_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_remaining numeric := p_quantity;
  v_batch record;
  v_taken numeric;
  v_consumed jsonb := '[]'::jsonb;
BEGIN
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
    )
    WHERE id = p_ingredient_id;

  RETURN jsonb_build_object(
    'requested', p_quantity, 'fulfilled', p_quantity - v_remaining,
    'shortfall', GREATEST(v_remaining, 0), 'batches', v_consumed
  );
END $$;
```

**Frontend files to change:**
- `src/lib/database.ts` — add `inventoryBatchesService.getByIngredient(ingredientId)`, `consumeIngredient(...)` (calls RPC), keep existing methods.
- `src/components/InventoryPage.tsx` — replace flat list with grouped/expandable rows. Use a `Map<ingredientId, Batch[]>` loaded once via `inventoryBatchesService.getAllForView(viewContext)` (one query: `select * from inventory_batches where ... order by received_at`). Add `expanded: Set<string>` state. Mobile and desktop both get expand/collapse.
- `src/components/InventoryCard.tsx` — accept `batches` prop, render expandable section.
- `src/components/OrdersPage.tsx` — ensure batch insert includes `attributes` (from `order_items.attributes`) and `supplier` (from `orders.supplier`).
- Recipe consumption call sites (search for `adjustQuantity` with negative change) — switch to `consumeIngredient` RPC.

**Backwards compatibility:** existing ingredients with `quantity > 0` and no batches get a synthetic "legacy" batch seeded by the migration:
```sql
INSERT INTO inventory_batches (ingredient_id, quantity, remaining_quantity, unit, purchase_price, currency, received_at, owner_id, restaurant_id, supplier, attributes)
SELECT id, quantity, quantity, unit, COALESCE(price_per_unit,0), 'RON', COALESCE(updated_at, now()), owner_id, restaurant_id, supplier, COALESCE(attributes,'{}'::jsonb)
FROM ingredients WHERE quantity > 0
  AND NOT EXISTS (SELECT 1 FROM inventory_batches b WHERE b.ingredient_id = ingredients.id);
```
