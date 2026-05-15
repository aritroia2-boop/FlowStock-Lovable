## Goal
Let employees use all paid features when their restaurant's owner has an active subscription. The owner is the only person who pays; employees inherit access through the restaurant link. Owner-only management actions stay restricted to the owner role.

## How access works today
- `profiles.is_subscribed` is read for the logged-in user only.
- `AppContext` exposes `canAccessRestaurantFeatures = is_subscribed || is_admin`.
- `useSubscriptionGuard` redirects anyone without that flag to the pricing page.
- Result: an employee whose owner pays still gets sent to pricing.

## Plan

### 1. Backend — effective access via the restaurant owner
Add a `SECURITY DEFINER` SQL function `public.get_effective_subscription()` that returns a row `{ is_subscribed boolean, source text }`:
- If the caller is `owner` (or has no `restaurant_id`), return their own `profiles.is_subscribed`, source = `self`.
- If the caller has a `restaurant_id`, look up `restaurants.owner_id`, then read that owner's `profiles.is_subscribed`. Return that value, source = `restaurant`.
- Falls back to `false` if anything is missing.

This avoids exposing other users' billing fields directly while still letting employees inherit access.

### 2. Auth loader — fold inherited access into `currentUser.is_subscribed`
In `src/lib/auth.ts` (`loadUser`):
- After fetching the profile, call `supabase.rpc('get_effective_subscription')`.
- Set `is_subscribed` to the effective value.
- Add a new field `subscription_source: 'self' | 'restaurant' | 'none'` on the user object so the UI can tailor copy.

No other gating code needs to change — `useSubscriptionGuard`, `OrdersPage`, AI invoice processing, etc. all read `is_subscribed` / `canAccessRestaurantFeatures` and will Just Work for employees.

### 3. Pricing page — friendlier copy for employees
In `src/components/PricingPage.tsx`:
- If `currentUser.role !== 'owner'` AND `subscription_source === 'restaurant'`: show an "Access provided by your restaurant" panel (no upgrade button, no manage-billing button).
- If `currentUser.role !== 'owner'` AND `subscription_source === 'none'`: show "Ask your restaurant owner to upgrade" (hide the Subscribe button — employees can't pay for the restaurant's plan from their own account).
- Owners keep the existing Subscribe / Manage Billing flow.

### 4. Owner-only actions stay role-gated
No changes needed — the following already check role/ownership and continue to work correctly:
- Restaurant settings, delete restaurant, invite/remove team members, edit restaurant-scoped ingredients/recipes (RLS uses `i_own_restaurant`).
- Employees keep the same per-role permissions on inventory, recipes, orders, dashboard, notifications they already had — they just stop being blocked by the paywall.

### 5. Real-time refresh
When the owner's subscription changes (Stripe webhook updates `profiles.is_subscribed`), employees' access updates on next session refresh / page load. No extra realtime channel needed for v1.

## Files touched
- New SQL migration: `get_effective_subscription()` function.
- `src/lib/auth.ts` — call RPC, set `is_subscribed` + `subscription_source`.
- `src/context/AppContext.tsx` — expose `subscriptionSource`.
- `src/components/PricingPage.tsx` — employee-aware copy.

## Out of scope
- No change to who can subscribe (only owners pay).
- No change to RLS policies on existing tables.
- No change to per-role feature permissions beyond removing the paywall block for employees of paying owners.
