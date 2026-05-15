
# Mobile & Tablet Redesign

Right now the app is designed desktop-first. On phones the dashboard cards feel huge, the sidebar drawer trigger overlaps the page title, the bottom nav crowds content, modals and tables overflow horizontally, and the inventory/orders pages don't reflow. Goal: make every page feel like it was built for the phone first, while keeping the desktop look intact.

## What will change

### 1. Global shell (AppLayout, top bar, sidebar, bottom nav)
- Add a real **mobile top bar** (sticky): hamburger on the left, page title in the center, notifications bell on the right. This removes the floating menu button overlapping the dashboard heading.
- Bottom nav: thinner (h-14), bigger tap targets, active item gets a pill background, safe-area padding for iPhone home bar, hide labels on very small screens, condense to 5 most-used items.
- Sidebar drawer: full-height, slide-in, swipe-to-close, larger row spacing.
- Add proper `pb-[env(safe-area-inset-bottom)]` and `pt-[env(safe-area-inset-top)]`.

### 2. Dashboard
- Stat cards: on mobile, switch from 4 huge cards to a **2-column compact grid** with smaller padding, smaller numbers, icon top-right, no hover-scale (causes layout shift on touch).
- Drop the second row's redundant gradients on mobile (flatter look).
- Recent Activity becomes a stacked list with truncation; Weekly Analytics chart gets horizontal scroll on phones.
- Header text scales down (text-xl on mobile, text-3xl on desktop).

### 3. Inventory page
- Replace the table view with **ingredient cards** on mobile (name, qty + unit, status pill, quick actions: Use / Add / Edit as icon buttons).
- Search + filter chips become a sticky horizontal scroll bar under the header.
- Add (+) becomes a **floating action button** on phones (bottom-right, above bottom nav).
- Modals become bottom sheets (using existing Drawer component) on mobile.

### 4. Orders page
- Order list: each order = a card with thumbnail of invoice, status badge, currency badge, total. Tap to open details.
- Upload area: full-width dashed drop zone with big "Take photo / Upload" buttons (camera input on phone).
- Confirm modal → bottom sheet on mobile.

### 5. Recipes page
- Grid: 1 column on phone, 2 on tablet, 3+ on desktop.
- Recipe card image aspect locked 16:9, ingredient availability pill, tap opens detail sheet.
- Recipe details modal becomes a full-screen sheet on mobile.

### 6. Settings, Audit Logs, Pricing, Login, Success/Cancel
- Convert hardcoded `max-w` containers to fluid `w-full max-w-*` with `px-4` on mobile.
- Settings sections become collapsible accordions on mobile.
- Audit logs: card list on mobile instead of table.
- Login: single column, larger inputs (h-12), bigger buttons, logo above form.
- Pricing: stack plan cards vertically on mobile, "Most popular" stays highlighted.

### 7. Forms, modals, inputs
- All inputs `h-11`/`h-12` on mobile so iOS doesn't zoom (`text-base`/16px font).
- Convert dialogs that hit viewport edge to **Drawer (vaul)** on `sm:` breakpoint and below.
- Sticky modal headers + footers so action buttons stay reachable.

### 8. Typography & spacing tokens
- Standardize: `text-2xl md:text-3xl lg:text-4xl` for page titles, `p-4 md:p-6 lg:p-8` for page padding, `gap-3 md:gap-6` for grids.
- Add a `useIsMobile` hook usage where layout actually branches (already exists at `src/hooks/use-mobile.tsx`).

## Technical notes

- New component: `src/components/MobileTopBar.tsx` rendered by `AppLayout` only on `md:hidden`.
- Touch FAB: small reusable `FloatingActionButton` component.
- Reuse existing `Drawer` (vaul) for bottom sheets; wrap pattern as `ResponsiveDialog` so each page calls one component and gets Dialog on desktop / Drawer on mobile.
- No backend/data changes. No route changes.
- Keep all dark-mode semantic tokens; this is layout/spacing only.

## Out of scope
- No new features, no schema changes, no copy rewrites beyond layout-driven truncation.
- Desktop layout stays visually the same.
