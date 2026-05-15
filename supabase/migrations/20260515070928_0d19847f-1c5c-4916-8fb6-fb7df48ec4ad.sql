ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RON';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS currency text;