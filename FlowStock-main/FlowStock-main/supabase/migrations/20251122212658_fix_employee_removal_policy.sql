/*
  # Fix Employee Removal - Update RLS Policy

  ## Problem
  The current "profile_update_employees" policy prevents owners from removing employees
  because the WITH CHECK clause requires restaurant_id IS NOT NULL, but removal sets it to NULL.

  ## Solution
  Update the policy to allow owners to:
  1. Update employee profiles within their restaurant
  2. Set employee restaurant_id to NULL (removing them from the restaurant)
  
  The key is checking the CURRENT restaurant_id (before update) to verify ownership,
  not requiring the NEW restaurant_id to be non-null.

  ## Changes
  1. Drop existing "profile_update_employees" policy
  2. Create new policy that allows:
     - Updating employees currently in owner's restaurant
     - Setting restaurant_id to NULL (employee removal)
     - Changing role to 'owner' when removing

  ## Security
  - Owners can only modify employees currently in their restaurant
  - Cannot modify employees from other restaurants
  - Cannot modify their own profile through this policy
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "profile_update_employees" ON profiles;

-- Create new policy that allows employee removal
CREATE POLICY "profile_update_employees"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- The profile being updated is not the current user
    id != auth.uid() 
    -- AND the profile currently belongs to a restaurant owned by the user
    AND restaurant_id IS NOT NULL
    AND public.i_own_restaurant(restaurant_id)
  )
  WITH CHECK (
    -- The profile being updated is not the current user
    id != auth.uid()
    -- AND either:
    -- 1. The profile still belongs to a restaurant owned by the user (updating within restaurant)
    AND (
      (restaurant_id IS NOT NULL AND public.i_own_restaurant(restaurant_id))
      OR
      -- 2. The profile is being removed from the restaurant (restaurant_id set to NULL)
      (restaurant_id IS NULL)
    )
  );