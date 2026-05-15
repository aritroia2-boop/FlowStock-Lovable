## Problem

The invoice processor fails on PDFs with:
> Unsupported image format for URL ... .pdf. Supported formats: PNG, JPEG, WebP, GIF. For other formats, use a data URL with the MIME type specified.

Currently `process-invoice/index.ts` passes the signed Supabase URL directly as `image_url`. Gemini accepts PDFs only as a base64 **data URL** with `application/pdf` MIME, not as a remote `.pdf` link.

## Fix

Update `supabase/functions/process-invoice/index.ts`:

1. After creating the signed URL, **fetch the file bytes** in the edge function.
2. Detect MIME from the storage path extension (`.pdf` → `application/pdf`, `.png` → `image/png`, `.jpg/.jpeg` → `image/jpeg`, `.webp` → `image/webp`).
3. Convert to base64 and build a `data:<mime>;base64,<...>` URL.
4. Pass that data URL to the AI gateway in the existing `image_url` content part (the gateway accepts data URLs for PDFs).
5. Keep the signed URL only for the fetch step; do not send the remote `.pdf` URL to the model.
6. Guard against very large files (>15 MB) with a clean error message so the user knows to re-upload a smaller scan.
7. Keep the flash → pro fallback, catalog hint, currency normalization, and `cleanItems` logic unchanged.

No DB changes, no UI changes, no other files touched.

## Why this works

Gemini (via Lovable AI Gateway) rejects PDFs only when given as a remote URL. The same model accepts PDFs when sent inline as `data:application/pdf;base64,...`. This matches the error message's own instruction.

## Out of scope

- Splitting multi-page PDFs into images
- Switching extraction model
- FIFO / inventory / matcher changes
