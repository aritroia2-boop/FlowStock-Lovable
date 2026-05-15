
# Make Invoice AI Faster & More Efficient

Goal: cut invoice processing time and cost without losing accuracy. Today every invoice goes to `google/gemini-2.5-pro` with the full PDF as base64, which is the slowest and most expensive path.

## Changes to `supabase/functions/process-invoice/index.ts`

### 1. Switch default model to a fast one
- Use `google/gemini-3-flash-preview` as the primary model (5–10x faster, much cheaper, strong at structured extraction with tool calling).
- Keep `google/gemini-2.5-pro` only as a **fallback** when flash returns 0 valid items or fails the schema. This gives us speed by default and accuracy when needed.

### 2. Send the PDF as a URL, not base64
- Today: download PDF from storage → base64 encode → send inline. Doubles payload size and adds a full download step on the edge function.
- New: create a short-lived **signed URL** for the file in `order-invoices` and send it as `image_url.url` directly. Removes the download + base64 step entirely.

### 3. Trim the prompt + schema
- The current system prompt is long and repeats rules. Tighten it to ~10 lines focused on: extract supplier, extract line items, exclude transport/TVA/total, detect currency.
- Remove `total_price` from the tool schema (we never use it; we recompute from qty × unit_price). Smaller schema = faster tool-call generation.

### 4. Parallelize DB writes
- Today: `update orders` → await → `insert order_items` → await. Run both in `Promise.all` since they don't depend on each other (order id is already known).

### 5. Early status update + no double `req.json()`
- The current `catch` block calls `req.json()` again, which throws because the body was already consumed. Parse once at the top, store `orderId`, reuse in the catch. This avoids a hidden second failure that masks the real error and slows the error path.

### 6. Cache supplier-name → matched ingredients hint (optional, small win)
- Pass the list of existing ingredient names for the user/restaurant into the prompt (just names, comma-separated, capped at ~200). The model returns names that already match our catalog, which makes the client-side `matchIngredients` step nearly instant and reduces "needs confirmation" rows.

### 7. Reduce post-processing work
- Move the irrelevant-keyword filter and dedupe into a single pass instead of two `.filter()` chains. Negligible CPU but cleaner.

## Expected impact

- ~3–6x faster end-to-end (flash vs pro, no base64 round-trip, parallel writes).
- Lower AI cost per invoice.
- Fewer "needs confirmation" items thanks to catalog hint.
- Same or better accuracy because pro is still used as a fallback.

## Out of scope
- No UI changes to `OrdersPage`.
- No DB schema changes.
- No change to how invoices are uploaded or to the order-items confirmation flow.

Approve and I'll implement.
