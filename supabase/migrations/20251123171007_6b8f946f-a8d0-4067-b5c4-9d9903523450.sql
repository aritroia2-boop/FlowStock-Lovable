/*
  # Add RLS Policies for Ingredients, Recipes, and Audit Logs
  
  Adds comprehensive RLS policies with ownership-based access control.
*/

-- Update ingredients foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ingredients' AND constraint_name = 'ingredients_restaurant_id_fkey'
  ) THEN
    ALTER TABLE ingredients ADD CONSTRAINT ingredients_restaurant_id_fkey 
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ingredients' AND constraint_name = 'ingredients_owner_id_fkey'
  ) THEN
    ALTER TABLE ingredients ADD CONSTRAINT ingredients_owner_id_fkey 
      FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update recipes foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'recipes' AND constraint_name = 'recipes_restaurant_id_fkey'
  ) THEN
    ALTER TABLE recipes ADD CONSTRAINT recipes_restaurant_id_fkey 
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'recipes' AND constraint_name = 'recipes_owner_id_fkey'
  ) THEN
    ALTER TABLE recipes ADD CONSTRAINT recipes_owner_id_fkey 
      FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ingredients policies
CREATE POLICY "ingredient_select_personal"
  ON ingredients FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY "ingredient_select_restaurant"
  ON ingredients FOR SELECT
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND restaurant_id = public.get_my_restaurant_id()
  );

CREATE POLICY "ingredient_select_shared"
  ON ingredients FOR SELECT
  TO authenticated
  USING (is_shared = true);

CREATE POLICY "ingredient_insert"
  ON ingredients FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ingredient_update_personal"
  ON ingredients FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL)
  WITH CHECK (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY "ingredient_update_restaurant"
  ON ingredients FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND public.i_own_restaurant(restaurant_id)
  )
  WITH CHECK (
    restaurant_id IS NOT NULL 
    AND public.i_own_restaurant(restaurant_id)
  );

CREATE POLICY "ingredient_delete_personal"
  ON ingredients FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY "ingredient_delete_restaurant"
  ON ingredients FOR DELETE
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND public.i_own_restaurant(restaurant_id)
  );

-- Recipes policies
CREATE POLICY "recipe_select_personal"
  ON recipes FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY "recipe_select_restaurant"
  ON recipes FOR SELECT
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND restaurant_id = public.get_my_restaurant_id()
  );

CREATE POLICY "recipe_select_shared"
  ON recipes FOR SELECT
  TO authenticated
  USING (is_shared = true);

CREATE POLICY "recipe_insert"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recipe_update_personal"
  ON recipes FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL)
  WITH CHECK (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY "recipe_update_restaurant"
  ON recipes FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND public.i_own_restaurant(restaurant_id)
  )
  WITH CHECK (
    restaurant_id IS NOT NULL 
    AND public.i_own_restaurant(restaurant_id)
  );

CREATE POLICY "recipe_delete_personal"
  ON recipes FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND restaurant_id IS NULL);

CREATE POLICY "recipe_delete_restaurant"
  ON recipes FOR DELETE
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND public.i_own_restaurant(restaurant_id)
  );

-- Recipe ingredients policies
CREATE POLICY "recipe_ingredient_select"
  ON recipe_ingredients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        (recipes.owner_id = auth.uid() AND recipes.restaurant_id IS NULL)
        OR (recipes.restaurant_id = public.get_my_restaurant_id())
        OR recipes.is_shared = true
      )
    )
  );

CREATE POLICY "recipe_ingredient_insert"
  ON recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        (recipes.owner_id = auth.uid() AND recipes.restaurant_id IS NULL)
        OR (recipes.restaurant_id IS NOT NULL AND public.i_own_restaurant(recipes.restaurant_id))
      )
    )
  );

CREATE POLICY "recipe_ingredient_update"
  ON recipe_ingredients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        (recipes.owner_id = auth.uid() AND recipes.restaurant_id IS NULL)
        OR (recipes.restaurant_id IS NOT NULL AND public.i_own_restaurant(recipes.restaurant_id))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        (recipes.owner_id = auth.uid() AND recipes.restaurant_id IS NULL)
        OR (recipes.restaurant_id IS NOT NULL AND public.i_own_restaurant(recipes.restaurant_id))
      )
    )
  );

CREATE POLICY "recipe_ingredient_delete"
  ON recipe_ingredients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_ingredients.recipe_id
      AND (
        (recipes.owner_id = auth.uid() AND recipes.restaurant_id IS NULL)
        OR (recipes.restaurant_id IS NOT NULL AND public.i_own_restaurant(recipes.restaurant_id))
      )
    )
  );

-- Audit logs policies
CREATE POLICY "audit_log_select_personal"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "audit_log_select_restaurant"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = audit_logs.user_id
      AND profiles.restaurant_id = public.get_my_restaurant_id()
      AND profiles.restaurant_id IS NOT NULL
    )
  );

CREATE POLICY "audit_log_insert"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());