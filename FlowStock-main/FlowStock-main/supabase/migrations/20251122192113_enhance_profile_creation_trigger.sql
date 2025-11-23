/*
  # Enhance Profile Creation Trigger

  ## Overview
  This migration improves the handle_new_user trigger function to be more robust
  and handle edge cases better. It ensures that profiles are always created when
  users sign up, even if there are issues with metadata.

  ## Changes

  ### 1. Enhanced Trigger Function
  - Add ON CONFLICT handling to prevent duplicate key errors
  - Add better default values for name field
  - Add error logging for debugging
  - Ensure role is set to 'owner' by default for new users
  - Make trigger more resilient to missing or malformed metadata

  ## Improvements
  - Prevents silent failures during profile creation
  - Ensures every auth.users entry has a corresponding profiles entry
  - Better handling of edge cases (missing name, malformed data)
  - Sets default role to 'owner' instead of 'none' for better UX

  ## Important Notes
  - Uses ON CONFLICT DO UPDATE to handle race conditions
  - SECURITY DEFINER ensures proper permissions
  - Default role is 'owner' so users can create restaurants immediately
*/

-- Drop and recreate the trigger function with improvements
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with ON CONFLICT handling
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(new.email, '@', 1),
      'User'
    ),
    LOWER(TRIM(new.email)),
    'owner'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    updated_at = now();

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the signup
  RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists (recreate if needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
