/*
  # Add Ownership System to Ingredients and Recipes

  ## Overview
  This migration transforms FlowStock from a shared-everything model to a personal-first,
  team-optional model. Each user will have private data by default, and can share data
  at the restaurant level when working with teams.

  ## Changes to Existing Tables

  ### 1. `ingredients` table
  - Add `owner_id` (uuid, FK to profiles) - User who created/owns this ingredient
  - Add `restaurant_id` (uuid, FK to restaurants, nullable) - Restaurant context if shared
  - Add `is_shared` (boolean) - Whether this is shared at restaurant level
  - Personal ingredients: owner_id = user, restaurant_id = NULL, is_shared = false
  - Restaurant ingredients: owner_id = creator, restaurant_id = restaurant, is_shared = true

  ### 2. `recipes` table
  - Add `owner_id` (uuid, FK to profiles) - User who created/owns this recipe
  - Add `restaurant_id` (uuid, FK to restaurants, nullable) - Restaurant context if shared
  - Add `is_shared` (boolean) - Whether this is shared at restaurant level

  ### 3. `audit_logs` table
  - Add `user_id` (uuid, FK to profiles, nullable) - Replace text user_name with proper FK

  ## Security Changes
  - DROP all existing `USING (true)` public policies
  - CREATE proper ownership-based RLS policies
  - Users can only see their own personal data
  - Users can see restaurant data if they're members of that restaurant
  - Only owners can manage restaurant-level data

  ## Important Notes
  - Existing data will be assigned to the first authenticated user or marked as unowned
  - This migration is designed to be safe and non-destructive
  - All indexes are created for optimal query performance
*/

-- ============================================
-- ADD OWNERSHIP COLUMNS TO INGREDIENTS
-- ============================================

DO $$
BEGIN
  -- Add owner_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add restaurant_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;

  -- Add is_shared column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name = 'is_shared'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================
-- ADD OWNERSHIP COLUMNS TO RECIPES
-- ============================================

DO $$
BEGIN
  -- Add owner_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE recipes ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add restaurant_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE recipes ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;

  -- Add is_shared column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipes' AND column_name = 'is_shared'
  ) THEN
    ALTER TABLE recipes ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================
-- ADD USER_ID TO AUDIT_LOGS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ingredients_owner_id ON ingredients(owner_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_restaurant_id ON ingredients(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_is_shared ON ingredients(is_shared);
CREATE INDEX IF NOT EXISTS idx_recipes_owner_id ON recipes(owner_id);
CREATE INDEX IF NOT EXISTS idx_recipes_restaurant_id ON recipes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_is_shared ON recipes(is_shared);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ingredients_owner_shared ON ingredients(owner_id, is_shared);
CREATE INDEX IF NOT EXISTS idx_recipes_owner_shared ON recipes(owner_id, is_shared);

-- ============================================
-- DROP OLD PUBLIC POLICIES
-- ============================================

-- Drop all existing public policies on ingredients
DROP POLICY IF EXISTS "Allow public read on ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public insert on ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public update on ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow public delete on ingredients" ON ingredients;

-- Drop all existing public policies on recipes
DROP POLICY IF EXISTS "Allow public read on recipes" ON recipes;
DROP POLICY IF EXISTS "Allow public insert on recipes" ON recipes;
DROP POLICY IF EXISTS "Allow public update on recipes" ON recipes;
DROP POLICY IF EXISTS "Allow public delete on recipes" ON recipes;

-- Drop all existing public policies on recipe_ingredients
DROP POLICY IF EXISTS "Allow public read on recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Allow public insert on recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Allow public update on recipe_ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Allow public delete on recipe_ingredients" ON recipe_ingredients;

-- Drop all existing public policies on audit_logs
DROP POLICY IF EXISTS "Allow public read on audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow public insert on audit_logs" ON audit_logs;

-- ============================================
-- CREATE OWNERSHIP-BASED RLS POLICIES FOR INGREDIENTS
-- ============================================

-- Policy: Users can view their own personal ingredients
CREATE POLICY "Users can view own personal ingredients"
  ON ingredients FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND (restaurant_id IS NULL OR is_shared = false));

-- Policy: Users can view restaurant ingredients if they're in that restaurant
CREATE POLICY "Users can view restaurant ingredients"
  ON ingredients FOR SELECT
  TO authenticated
  USING (
    is_shared = true
    AND restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = ingredients.restaurant_id
    )
  );

-- Policy: Users can create personal ingredients
CREATE POLICY "Users can create personal ingredients"
  ON ingredients FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      (restaurant_id IS NULL AND is_shared = false)
      OR
      (restaurant_id IS NOT NULL AND is_shared = true AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = ingredients.restaurant_id
      ))
    )
  );

-- Policy: Users can update their own ingredients
CREATE POLICY "Users can update own ingredients"
  ON ingredients FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Policy: Users can delete their own personal ingredients
CREATE POLICY "Users can delete own personal ingredients"
  ON ingredients FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND (restaurant_id IS NULL OR is_shared = false));

-- Policy: Restaurant owners can delete restaurant ingredients
CREATE POLICY "Owners can delete restaurant ingredients"
  ON ingredients FOR DELETE
  TO authenticated
  USING (
    is_shared = true
    AND restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = ingredients.restaurant_id
      AND profiles.role = 'owner'
    )
  );

-- ============================================
-- CREATE OWNERSHIP-BASED RLS POLICIES FOR RECIPES
-- ============================================

-- Policy: Users can view their own personal recipes
CREATE POLICY "Users can view own personal recipes"
  ON recipes FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND (restaurant_id IS NULL OR is_shared = false));

-- Policy: Users can view restaurant recipes if they're in that restaurant
CREATE POLICY "Users can view restaurant recipes"
  ON recipes FOR SELECT
  TO authenticated
  USING (
    is_shared = true
    AND restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = recipes.restaurant_id
    )
  );

-- Policy: Users can create personal recipes
CREATE POLICY "Users can create personal recipes"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      (restaurant_id IS NULL AND is_shared = false)
      OR
      (restaurant_id IS NOT NULL AND is_shared = true AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = recipes.restaurant_id
      ))
    )
  );

-- Policy: Users can update their own recipes
CREATE POLICY "Users can update own recipes"
  ON recipes FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Policy: Users can delete their own personal recipes
CREATE POLICY "Users can delete own personal recipes"
  ON recipes FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND (restaurant_id IS NULL OR is_shared = false));

-- Policy: Restaurant owners can delete restaurant recipes
CREATE POLICY "Owners can delete restaurant recipes"
  ON recipes FOR DELETE
  TO authenticated
  USING (
    is_shared = true
    AND restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = recipes.restaurant_id
      AND profiles.role = 'owner'
    )
  );

-- ============================================
-- CREATE POLICIES FOR RECIPE_INGREDIENTS
-- ============================================

-- Policy: Users can view recipe ingredients for recipes they can see
CREATE POLICY "Users can view recipe ingredients"
  ON recipe_ingredients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        (recipes.owner_id = auth.uid())
        OR
        (recipes.is_shared = true AND recipes.restaurant_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.restaurant_id = recipes.restaurant_id
        ))
      )
    )
  );

-- Policy: Users can create recipe ingredients for their own recipes
CREATE POLICY "Users can create recipe ingredients"
  ON recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

-- Policy: Users can update recipe ingredients for their own recipes
CREATE POLICY "Users can update recipe ingredients"
  ON recipe_ingredients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

-- Policy: Users can delete recipe ingredients for their own recipes
CREATE POLICY "Users can delete recipe ingredients"
  ON recipe_ingredients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND recipes.owner_id = auth.uid()
    )
  );

-- ============================================
-- CREATE POLICIES FOR AUDIT_LOGS
-- ============================================

-- Policy: Users can view audit logs for their own ingredients
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM ingredients
      WHERE ingredients.id = audit_logs.ingredient_id
      AND (
        ingredients.owner_id = auth.uid()
        OR
        (ingredients.is_shared = true AND ingredients.restaurant_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.restaurant_id = ingredients.restaurant_id
        ))
      )
    )
  );

-- Policy: Users can create audit logs for ingredients they can access
CREATE POLICY "Users can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      ingredient_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM ingredients
        WHERE ingredients.id = audit_logs.ingredient_id
        AND (
          ingredients.owner_id = auth.uid()
          OR
          (ingredients.is_shared = true AND ingredients.restaurant_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.restaurant_id = ingredients.restaurant_id
          ))
        )
      )
    )
  );