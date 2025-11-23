/*
  # Fix RLS Policy for Adding Restaurant Employees

  ## Problem
  The current `profile_update_by_owner` policy prevents owners from adding NEW employees
  because the USING clause requires `restaurant_id IS NOT NULL`, but new employees 
  have `restaurant_id = NULL` initially.

  ## Solution
  Update the USING clause to allow owners to:
  1. Add NEW employees (restaurant_id IS NULL → owner's restaurant)
  2. Manage existing employees in their restaurant
  3. Remove employees (set restaurant_id back to NULL)

  ## Security Preserved
  - Owners cannot modify their own profile through this policy
  - Owners cannot steal employees from other restaurants
  - Owners can only modify unassigned employees or their own employees
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "profile_update_by_owner" ON profiles;

-- Create new policy with corrected logic
CREATE POLICY "profile_update_by_owner"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- The profile being updated is not the current user
    id != auth.uid() 
    -- AND either:
    AND (
      -- 1. The profile is currently unassigned (allows adding NEW employees)
      restaurant_id IS NULL
      OR
      -- 2. The profile currently belongs to a restaurant owned by the user
      (restaurant_id IS NOT NULL AND i_own_restaurant(restaurant_id))
    )
  )
  WITH CHECK (
    -- The profile being updated is not the current user
    id != auth.uid()
    -- AND either:
    AND (
      -- 1. Setting to owner's restaurant
      (restaurant_id IS NOT NULL AND i_own_restaurant(restaurant_id))
      OR
      -- 2. Removing from restaurant (set to NULL)
      restaurant_id IS NULL
    )
  );