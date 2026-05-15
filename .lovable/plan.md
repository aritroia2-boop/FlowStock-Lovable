## Goals

1. Actually fix invoice processing (base64 bug + retry + UI to retry/see errors).
2. Accept images, not just PDFs (JPG, PNG, WebP, HEIC).
3. On mobile, let the user snap a photo directly from the app and process it as an invoice.

## 1. Edge function — `supabase/functions/process-invoice/index.ts`

- Replace the chunked `String.fromCharCode` + `btoa` encoder with `encodeBase64` from `jsr:@std/encoding/base64`. This is the most likely root cause of "The document has no pages." — the current encoder produces a corrupt base64 for some PDFs.
- Validate downloaded bytes:
  - PDFs must start with `%PDF-`.
  - Images must start with their magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF…WEBP`, GIF `GIF8`).
  - Reject anything else with a clear "unsupported or corrupt file" message.
- Extend `mimeMap` to include `heic`/`heif` → `image/heic`. Gemini accepts these.
- Add a single retry per model when the provider returns `The document has no pages` or a 5xx, with 1s backoff. Keep flash → pro fallback.
- Keep 15 MB cap.

## 2. Upload layer — `src/lib/supabase.ts`

- Rename intent of `uploadOrderInvoice` to accept PDF **and** images.
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.
- Pick the storage extension from the original filename / MIME (don't hard-code `.pdf`).
- Bump size limit to 15 MB to match the edge function.

## 3. Orders UI — `src/components/OrdersPage.tsx`

- File input: `accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"`.
- Add a second button next to "Upload Invoice": **"Take photo"** — only visible on mobile (`useIsMobile`). It uses a hidden `<input type="file" accept="image/*" capture="environment">`, which opens the native camera on iOS/Android.
- Add a **Retry** button when `order.status === 'error'`. Handler resets the row to `pending` then calls the same processing flow.
- Render `order.error_message` (truncated, with a tooltip / expandable) under the error badge.
- On failure, surface the real error message from the edge function in the toast instead of the generic "Failed to process invoice".
- Show a small file-type badge per order (PDF / IMG) based on extension.

## 4. No DB or schema changes

- `orders.error_message` already exists.
- `order-invoices` bucket already exists and is private — no policy changes needed; uploads continue to use signed URLs server-side.

## Out of scope

- Server-side HEIC → JPEG conversion (Gemini handles HEIC directly; if it ever rejects, we can add this later).
- Rasterizing multi-page PDFs to images.
- Background-job architecture — current single-call flow is fast enough for typical invoices.
- FIFO / inventory / matcher logic.

## Files touched

- `supabase/functions/process-invoice/index.ts` — proper base64, magic-byte validation, image MIME support, retry on "no pages" / 5xx.
- `src/lib/supabase.ts` — accept images in `uploadOrderInvoice`, correct extension, 15 MB cap.
- `src/components/OrdersPage.tsx` — file input accepts images, mobile "Take photo" button, Retry button for errors, show real error message and file-type badge.
