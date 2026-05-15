## Goals
1. Force the entire app into permanent dark mode and remove the toggle.
2. Make every page (not just dashboard) actually look correct in dark mode.
3. Remove the Quick Actions panel from the Dashboard.
4. Replace the `$` currency symbol with `RON` (lei) everywhere in the UI.
5. Make invoice processing detect and store the currency from each invoice (RON / EUR / USD), and display amounts in that currency on the Orders page.
6. Rename the inventory "Decrease" action to "Use" (button title, modal title, related labels).
7. Fix Dashboard "Active Users" so it counts only users belonging to the current user's restaurant (and shows 0/1 correctly when alone).

## 1. Permanent dark mode
- In `src/App.tsx`, replace the `ThemeProvider` config with `attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}`. This locks the `dark` class on `<html>` regardless of OS / stored preference.
- In `src/index.css`, also add `dark` class to `:root` defaults (or set `:root` variables to the dark palette) as a safety net so the app is dark even before React mounts. Update the loading screen gradient in `App.tsx` to use `bg-background` instead of light blue.
- Remove every theme toggle UI:
  - Search and remove toggle buttons / `useTheme()` `setTheme` calls in `ResponsiveSidebar.tsx`, `MobileNav.tsx`, `SettingsPage.tsx`, and any header dropdowns.
- Keep `next-themes` installed (still used to apply the class).

## 2. Make dark mode look good across the whole app
Continue the semantic-token migration started earlier. Audit and convert hardcoded light classes (`bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`, light gradients without `dark:` variants) to tokens (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`) plus `dark:` gradient variants in:
- `InventoryPage.tsx` (remaining modals: Add, Increase, Use, Edit; table rows; status pills backgrounds)
- `RecipesPage.tsx` (recipe cards, cost badge, modals)
- `RecipeDetailsModal.tsx` (full pass)
- `OrdersPage.tsx` (status cards, upload area, extraction review panel)
- `SettingsPage.tsx` (remaining sections: restaurant, team management, employees, danger zone)
- `AuditLogPage.tsx` (filters, table)
- `InventoryCard.tsx`, `WeeklyAnalytics.tsx` (chart text/legend colors)
- `LoginPage.tsx` (already partially done — finish background + sign-up modal)
- `SuccessPage.tsx`, `CancelPage.tsx`, `PricingPage.tsx`, `SubscribeBanner.tsx` (verify)
Goal: every page reads cleanly on the dark background, with proper contrast for text, inputs, borders, hovers, and modals.

## 3. Remove Quick Actions from Dashboard
In `src/components/Dashboard.tsx`, delete the `{myTeams.length === 0 && (... Quick Actions ...)}` block entirely. The Recent Activity card stays. If the user has no teams, that column simply ends after Recent Activity.

## 4. Currency: replace `$` with `RON`
- Create a small helper `src/lib/currency.ts` exporting `formatMoney(amount, currency = 'RON')` that returns e.g. `"1,250.00 RON"` (or `"1.250,00 RON"` — Romanian formatting via `Intl.NumberFormat('ro-RO', { style: 'currency', currency })`).
- Update everywhere `$` is hardcoded in front of a number:
  - `Dashboard.tsx` — Inventory Value card.
  - `RecipesPage.tsx` line 243 — recipe cost.
  - `InventoryCard.tsx` line 51 — price per unit.
  - `WeeklyAnalytics.tsx` — any `$` in tooltips/labels (and switch the `DollarSign` lucide icon to a neutral icon like `Banknote` or keep icon but it's just decorative).
  - `RecipeDetailsModal.tsx`, `OrdersPage.tsx`, `SettingsPage.tsx` — any cost/price displays.
  - `unitConverter.ts` `formatPrice` already uses `lei` — keep but standardize wording to `RON/<unit>` for consistency.
- Default display currency = `RON`. For order/invoice items, display in the currency stored on that order (see step 5).

## 5. Detect invoice currency
Database:
- Add a `currency text not null default 'RON'` column to `orders`.
- Add a `currency text` column to `order_items` (nullable, falls back to the parent order's currency).

Edge function `supabase/functions/process-invoice/index.ts`:
- Extend the AI extraction prompt + JSON schema to also return a top-level `currency` field (ISO 4217: `RON`, `EUR`, `USD`, etc.). Detection rules: look for `RON`, `LEI`, `lei`, `€`, `EUR`, `$`, `USD`, `MDL`, `GBP`, `£` near totals or in the header, defaulting to `RON` if ambiguous (Romanian invoices).
- When the function inserts the order/items, persist the detected `currency` on the `orders` row (and optionally per item).

Frontend (`OrdersPage.tsx` + anywhere that renders invoice amounts):
- Read `order.currency` and pass it to `formatMoney(amount, order.currency)` so each invoice shows its own currency. Inventory/recipes still default to `RON`.

## 6. Rename inventory "Decrease" → "Use"
In `InventoryPage.tsx`:
- Rename state and handlers for clarity: `showDecreaseModal` → `showUseModal`, `openDecreaseModal` → `openUseModal`, `handleDecreaseQuantity` → `handleUseQuantity` (internal only).
- Button `title="Decrease quantity"` → `title="Use"`; if there is visible label text, set it to `Use`.
- Modal heading `Decrease Quantity` → `Use Ingredient`; submit button label → `Use`; validation message `Cannot decrease by more than current quantity` → `Cannot use more than current stock`.
- Audit log operation strings stay the same data-wise but, where shown to the user as "decrease/decreased", relabel to "used".

## 7. Dashboard "Active Users" accuracy
Current code in `Dashboard.tsx > loadStats`:
```
supabase.from('team_members').select('*', { count:'exact', head:true }).eq('status','active')
```
This counts active `team_members` across ALL restaurants visible to the user, and a single user can produce multiple rows (one per team they belong to).

Fix:
- Compute distinct active members of the current user's restaurant only:
  - First get `currentUser.restaurant_id` (already loaded as `restaurantInfo`/profile).
  - If the user has a `restaurant_id`, query `profiles` filtered by `restaurant_id = <my restaurant>` and count rows. This represents everyone (owner + employees) in the restaurant.
  - If the user has no restaurant, show `1` (just you).
- Update the card subtitle to "Members in your restaurant" so it's clear what is being counted.

(Note: Supabase auth doesn't expose a real "currently online" presence without Realtime presence channels. Counting restaurant members matches the user's expectation — they were the only person in their restaurant and want to see `1`.)

## Out of scope
- No new Stripe / subscription changes.
- No light-mode theme switcher (explicitly removed).
- No realtime presence tracking for "online now" — using restaurant member count.

## Order of execution
1. DB migration: add `currency` columns to `orders` and `order_items`.
2. Force dark mode + remove toggle (App.tsx, ThemeProvider usage, sidebars).
3. Token sweep across remaining pages/modals.
4. Dashboard: remove Quick Actions, fix Active Users count.
5. Add `formatMoney` helper, replace `$` everywhere with RON.
6. Update `process-invoice` edge function to extract currency; render order amounts with their own currency.
7. Inventory: rename Decrease → Use across UI.