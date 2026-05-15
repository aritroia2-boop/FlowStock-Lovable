
# Fix Settings page dark mode

The Settings page still uses ~40 hardcoded light-mode classes (`bg-white`, `bg-blue-50`, `from-blue-50 to-cyan-50`, `text-slate-300/400`, `text-gray-*`, etc.). They were never paired with `dark:` variants, so in dark mode you get bright white panels, washed-out backgrounds and unreadable gray-on-dark text.

## What to change (single file: `src/components/SettingsPage.tsx`)

Token sweep — replace hardcoded colors with semantic tokens that already work in dark mode:

- `bg-white` → `bg-card`
- `bg-gray-50` / `bg-slate-50` / `bg-blue-50` (as section backgrounds) → `bg-muted/40` or `bg-card`
- Soft tinted info boxes like `bg-gradient-to-br from-blue-50 to-cyan-50` (member card, info banners) → keep gradient but add `dark:from-blue-950/30 dark:to-cyan-950/30` and switch border to `border-border`
- `border-gray-*` / `border-blue-100` → `border-border`
- `text-gray-900` / `text-slate-900` → `text-foreground`
- `text-gray-700` / `text-gray-600` / `text-slate-700` → `text-muted-foreground` (or `text-foreground` for emphasis)
- `text-gray-500` / `text-slate-500` / `text-slate-400` / `text-slate-300` (empty-state icons & captions) → `text-muted-foreground`
- `placeholder-gray-*` → `placeholder:text-muted-foreground`
- Inputs / textareas with `bg-white` and `border-gray-*` → `bg-background border border-input text-foreground`
- Hover states `hover:bg-gray-50` → `hover:bg-accent`
- Status pills (red/orange/green) keep their hue but get `dark:bg-*-950/40 dark:text-*-300` paired variants where the badge currently uses light-only `bg-*-100 text-*-700`

Keep the colored gradient headers (blue→cyan), buttons, role badges and brand accents — they read fine on dark already.

## Verification
- After edits, open Settings on the preview in dark mode and check: profile card, restaurant section, team members list, teams list, danger zone, and empty states. All panels should sit on the dark background, all body text legible, all inputs visible.

## Out of scope
- No layout, copy, behavior, or backend changes.
- Other pages aren't touched.
