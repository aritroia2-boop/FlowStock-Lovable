/*
  # Add Restaurant Exit and Delete Functionality

  ## Overview
  This migration adds secure functions for users to leave or delete restaurants
  with proper safety checks and data cleanup.

  ## Changes
  1. Functions
    - `leave_restaurant()` - Allows employees to leave a restaurant
    - `delete_restaurant()` - Allows owners to delete their restaurant
  
  ## Security
  - Only employees can leave restaurants (not owners)
  - Only the restaurant owner can delete their restaurant
  - Deleting a restaurant removes all associated employees and resets them to owner status
  - All team memberships are automatically cleaned up via CASCADE
  - Function security definer ensures proper permission checks

  ## Important Notes
  - When a restaurant is deleted, all employees are reset to 'owner' role with no restaurant
  - The restaurant owner is also reset to 'owner' role with no restaurant
  - All teams and team_members are automatically deleted via CASCADE foreign keys
  - Recipes and ingredients owned by the restaurant remain in the database for audit purposes
*/

-- Function for employees to leave a restaurant
CREATE OR REPLACE FUNCTION leave_restaurant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_restaurant_id uuid;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's current role and restaurant
  SELECT role, restaurant_id INTO v_user_role, v_restaurant_id
  FROM profiles
  WHERE id = v_user_id;

  -- Only employees can leave (owners must delete the restaurant)
  IF v_user_role != 'employee' THEN
    RAISE EXCEPTION 'Only employees can leave restaurants. Owners must delete the restaurant instead.';
  END IF;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'You are not part of any restaurant';
  END IF;

  -- Remove user from all teams first (optional, CASCADE will handle this)
  DELETE FROM team_members WHERE profile_id = v_user_id;

  -- Update profile to remove restaurant association
  UPDATE profiles
  SET 
    restaurant_id = NULL,
    role = 'owner',
    updated_at = now()
  WHERE id = v_user_id;

END;
$$;

-- Function for owners to delete their restaurant
CREATE OR REPLACE FUNCTION delete_restaurant(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get restaurant owner
  SELECT owner_id INTO v_owner_id
  FROM restaurants
  WHERE id = p_restaurant_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  -- Only the owner can delete the restaurant
  IF v_owner_id != v_user_id THEN
    RAISE EXCEPTION 'Only the restaurant owner can delete the restaurant';
  END IF;

  -- Remove all employees from the restaurant and reset them to owner role
  UPDATE profiles
  SET 
    restaurant_id = NULL,
    role = 'owner',
    updated_at = now()
  WHERE restaurant_id = p_restaurant_id;

  -- Delete the restaurant (CASCADE will handle teams and team_members)
  DELETE FROM restaurants WHERE id = p_restaurant_id;

END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION leave_restaurant() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_restaurant(uuid) TO authenticated;
