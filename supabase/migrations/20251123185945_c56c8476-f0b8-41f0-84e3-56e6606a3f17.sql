-- Add missing columns to ingredients table
ALTER TABLE public.ingredients 
  ADD COLUMN IF NOT EXISTS minimum_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS supplier text;

-- Add missing cost column to recipes table  
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cost numeric NOT NULL DEFAULT 0;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON public.ingredients(category);
CREATE INDEX IF NOT EXISTS idx_recipes_cost ON public.recipes(cost);