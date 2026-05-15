## 1. Employees: free restaurant access, paid personal features

**Current behavior:** `useSubscriptionGuard` redirects any user without `is_subscribed || is_admin` straight to the pricing page. That blocks employees from everything, even though they should have restaurant access via inheritance from the owner.

**New behavior:**
- Employees with `subscriptionSource === 'restaurant'` (their owner pays) get full access to **restaurant** features on Inventory, Recipes, Orders, Audit Logs, Dashboard, Settings.
- Personal features (the "Personal" tab on Inventory / Recipes / Orders) require **their own** Pro subscription (`subscriptionSource === 'self'` or `is_admin`).
- Owners and admins keep current behavior unchanged.

**Changes:**
- `src/hooks/useSubscriptionGuard.ts` — allow access when user is admin OR subscribed OR has any inherited subscription (`subscriptionSource !== 'none'`). Only redirect users with no access at all.
- `src/components/InventoryPage.tsx`, `src/components/RecipesPage.tsx`, `src/components/OrdersPage.tsx`:
  - Add a `canUsePersonal = isAdmin || subscriptionSource === 'self'` flag.
  - Default `viewContext` to `'restaurant'` for employees who can't use personal.
  - When the user clicks the "Personal" tab without access, show a paywall card in the content area (lock icon + "Personal features require a Pro plan" + "Upgrade to Pro" button → `setCurrentPage('pricing')`) instead of the data list. The tab itself stays clickable so they discover the upsell.
- `src/components/PricingPage.tsx` — for employees inheriting restaurant access (`subscriptionSource === 'restaurant'`), keep the "Access Provided by Your Restaurant" panel but add a secondary section: "Want to use Personal inventory, recipes and orders? Upgrade to Pro for personal features." with a working Subscribe button (it already exists for owners; we extend it to employees too — Stripe checkout already works per-user).

## 2. Audit Logs: working date filter + better label

**Current:** `AuditLogPage` shows a static "Timestamp" pill with two calendar icons that does nothing.

**Changes in `src/components/AuditLogPage.tsx`:**
- Replace the pill with two `<input type="date">` controls labeled **"From"** and **"To"** (rename "Timestamp" → "Date range").
- Add `filterDateFrom` and `filterDateTo` state.
- Extend `filteredLogs` to also match `created_at` between the selected dates (inclusive, end-of-day for "To").
- Style the inputs to match the other filter pills (same border, padding, rounded, dark-mode aware via semantic tokens).

## 3. Settings dark mode fix (team members + teams sections)

The screenshot shows hard white cards in dark mode. The culprit is hard-coded Tailwind colors like `bg-gradient-to-r from-slate-50 to-slate-100`, `bg-gradient-to-br from-orange-50 to-amber-50`, and the gray team header bar.

**Changes in `src/components/SettingsPage.tsx`:**
- Team member row (~line 1158): replace `from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200` with `bg-muted hover:bg-muted/70` (semantic tokens, dark-mode aware).
- "Create New Team" panel (~line 1213): `from-orange-50 to-amber-50 border-orange-100` → `bg-orange-500/10 border-orange-500/30`.
- Team card header (the gray "Staff" bar in the screenshot) and any other `bg-slate-*`, `bg-orange-50`, `bg-white`, `border-orange-100/200` in this section: swap to `bg-card`, `bg-muted`, `border-border`, or `bg-orange-500/10` so they render correctly in both themes.
- Inputs inside team panels: use `bg-background text-foreground border-border` instead of hard-coded white.

Audit each block from line ~1140 to the end of the Teams section (~line 1380) and convert remaining hard-coded light colors to semantic tokens.

## Out of scope
- No DB schema changes.
- No changes to per-role permissions or RLS.
- No change to who can subscribe — both owners and employees can buy their own Pro for personal features.
