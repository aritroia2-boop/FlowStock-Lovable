# Advanced Invoice Processing Upgrade

Goal: make invoice AI extract clean structured data, match to inventory using attribute-aware semantic logic, and keep invoice prices separate from the product's standard reference price so inventory value reflects real cost per batch.

## 1. Schema changes (migration)

**`ingredients` table** — add a baseline reference field (the "standard price" stays as `price_per_unit`, but we add):
- `standard_price` numeric — manually-set baseline reference price (defaults from first ever entry).
- `last_purchase_price` numeric — most recent invoice unit price.
- `attributes` jsonb — `{ fat_pct, protein_pct, brand, packaging_size, type, ... }` used for matching.

**`order_items` table** — extend extraction output:
- `normalized_name` text
- `attributes` jsonb (fat %, brand, size, etc.)
- `total_price_line` numeric
- `confidence_score` numeric (0–1 match score)
- `invoice_unit_price` numeric (the real invoice price; existing `price_per_unit` becomes alias)

**New table `inventory_batches`** — one row per accepted invoice line, so valuation uses per-batch real cost:
- `ingredient_id`, `order_id`, `quantity`, `unit`, `purchase_price` (from invoice), `currency`, `received_at`
- Powers `inventory_value = sum(remaining_qty_per_batch * batch.purchase_price)`.

**`orders` table** — add `invoice_date date` (extracted from invoice).

RLS mirrors existing patterns (personal vs restaurant).

## 2. Edge function `process-invoice` rewrite

**Prompt** asks the model to extract:
- supplier_name, invoice_date, currency
- For each item: `product_name_raw`, `normalized_name`, `attributes` (fat %, protein %, brand, packaging, type), `quantity`, `unit`, `unit_price`, `total_price_line`
- Hard rules in prompt: ignore promo words ("premium", "ofertă", "promoție", slogans, headers/footers, transport/TVA/discount/total lines). Keep attribute info inside the product name (don't strip "4.5%").

**Tool schema** updated to match. `total_price_line` recomputed = `qty * unit_price` if missing.

**Catalog hint**: pass existing ingredients with their `attributes` so the model returns matching `normalized_name` when applicable.

## 3. Semantic matcher rewrite (`src/lib/ingredientMatcher.ts`)

Replace pure Levenshtein with a hybrid score:
- **Base name similarity** (existing fuzzy + Romanian synonyms) — 50%
- **Attribute compatibility** — 50%, but acts as a **gate**:
  - If invoice has `fat_pct=4.5` and candidate has `fat_pct=2`, score is hard-capped at 0.4 (not a match).
  - Same for `brand`, `protein_pct`, `packaging_size`, `type`.
  - Missing attributes on candidate = neutral; missing on invoice = neutral.
- Confidence buckets:
  - `>= 0.9` auto-match
  - `0.7–0.9` suggest, requires confirmation
  - `< 0.7` → "create new product" suggestion (never auto-match)

Returns `{ matchedIngredient, confidence, needsConfirmation, isNewIngredient, attributes }`.

Example outcomes:
- "Lapte 4.5% grasime" vs DB "Lapte" (no fat) → confidence ~0.6, suggest new product.
- "Lapte 4.5%" vs DB "Lapte 4.5% Zuzu" → high if brand matches, otherwise ~0.75 suggest.

## 4. Price handling rules (business logic)

When an invoice line is confirmed in `OrdersPage`:
- Always store `invoice_unit_price` on the `order_item` and on a new `inventory_batches` row.
- Update `ingredients.last_purchase_price = invoice_unit_price`.
- **Never** overwrite `ingredients.standard_price` automatically. UI shows the diff (e.g. "Standard: 10 RON/kg, Invoice: 6 RON/kg, −40%").
- New ingredient created from invoice → `standard_price = invoice_unit_price` (initial seed) and a batch is created.

## 5. Inventory valuation

`InventoryPage` total value computed from batches:
```
value = Σ (batch.remaining_quantity * batch.purchase_price)
```
Falls back to `last_purchase_price` for ingredients without batches (legacy data). Standard price is shown but not used for valuation.

Stock decrements (recipes / sales) consume batches FIFO, decreasing `remaining_quantity`.

## 6. UI changes

- **OrdersPage confirm modal**: show `extracted_name`, detected `attributes` chips, suggested match with confidence %, alternatives, "Create new product" CTA when confidence low. Show invoice price vs standard price side by side.
- **InventoryPage**: add columns `Standard Price`, `Last Purchase Price`, `Δ%`. Tooltip shows recent batches.
- **Ingredient edit form**: editable `standard_price` and `attributes` (fat %, brand, packaging).

## 7. Out of scope

- No auth, role, or subscription changes.
- No changes to recipes/orders unrelated to invoice flow.
- No new third-party integrations; continues to use Lovable AI Gateway with `google/gemini-3-flash-preview` (pro fallback).

## Files affected

- `supabase/migrations/<new>.sql` — schema additions
- `supabase/functions/process-invoice/index.ts` — extended extraction
- `src/lib/ingredientMatcher.ts` — attribute-aware scoring
- `src/lib/database.ts` — `inventoryBatchesService`, batch creation on confirm
- `src/components/OrdersPage.tsx` — richer confirm modal, attribute chips, price diff, new-product CTA
- `src/components/InventoryPage.tsx` — show standard vs purchase price, batch-based valuation
- `src/components/InventoryCard.tsx` — price diff indicator
- `src/integrations/supabase/types.ts` — auto-regenerated

## Acceptance

- Promo words / transport / TVA never appear as items.
- "Lapte 4.5%" doesn't match plain "Lapte"; offers create-new instead.
- After confirming an invoice with discounted prices, `ingredients.standard_price` is unchanged, batch records the invoice price, inventory value uses batch price.
- JSON output per invoice matches the structure in the request.
