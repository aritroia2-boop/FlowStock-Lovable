/*
  # Add Recipe Details and Image Support

  1. Schema Changes
    - Add `description` column to recipes table (text, nullable)
    - Add `image_url` column to recipes table (text, nullable)
    - Add `unit` column to recipe_ingredients table (text, default 'kg')

  2. Purpose
    - Enable storing recipe descriptions
    - Support recipe image URLs from Supabase Storage
    - Store proper units for each ingredient in recipes
*/

-- Add description and image_url to recipes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'description'
  ) THEN
    ALTER TABLE recipes ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE recipes ADD COLUMN image_url text;
  END IF;
END $$;

-- Add unit to recipe_ingredients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipe_ingredients' AND column_name = 'unit'
  ) THEN
    ALTER TABLE recipe_ingredients ADD COLUMN unit text DEFAULT 'kg';
  END IF;
END $$;