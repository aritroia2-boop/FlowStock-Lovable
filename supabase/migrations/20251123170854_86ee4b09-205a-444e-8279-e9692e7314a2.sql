/*
  # Create User Profiles Table
  
  Creates profiles table for user data with automatic profile creation trigger.
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'owner',
  restaurant_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_restaurant ON profiles(restaurant_id);

-- Function to create profile automatically when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
  RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function when new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function to set default owner role
CREATE OR REPLACE FUNCTION set_default_owner_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NULL OR NEW.role = 'none' THEN
    NEW.role := 'owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set default owner role
DROP TRIGGER IF EXISTS trigger_set_default_owner_role ON profiles;
CREATE TRIGGER trigger_set_default_owner_role
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_owner_role();

-- Basic RLS policies for profiles
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to search profiles (needed for invitations)
CREATE POLICY "Authenticated users can search profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);