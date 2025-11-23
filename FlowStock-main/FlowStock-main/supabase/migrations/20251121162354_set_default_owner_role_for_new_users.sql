/*
  # Set Default Owner Role for New Users

  1. Changes
    - Update the default value for the `role` column in `profiles` table to 'owner'
    - Create a trigger function to automatically set role to 'owner' for new profiles
    - This ensures all new user signups become owners by default
  
  2. Benefits
    - New users can immediately access Settings page
    - New users can create their own restaurants
    - Simplified onboarding experience
  
  3. Security
    - Maintains existing RLS policies
    - Only affects new user registrations
    - Does not modify existing user roles
*/

-- Update the default value for role column to 'owner'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'owner';
  END IF;
END $$;

-- Create or replace function to set default owner role
CREATE OR REPLACE FUNCTION set_default_owner_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set role if it's null or 'none'
  IF NEW.role IS NULL OR NEW.role = 'none' THEN
    NEW.role := 'owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and create it
DROP TRIGGER IF EXISTS trigger_set_default_owner_role ON profiles;
CREATE TRIGGER trigger_set_default_owner_role
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_owner_role();
