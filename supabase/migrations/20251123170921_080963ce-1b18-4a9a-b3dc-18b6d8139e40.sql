/*
  # Create Restaurants Table and Teams System
  
  Creates restaurants, teams, team_members tables with proper RLS policies and helper functions.
*/

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  logo_url text,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_restaurant_id_fkey'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_restaurant_id_fkey 
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, profile_id)
);

-- Enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_restaurant ON teams(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile ON team_members(profile_id);

-- Helper functions for RLS (with proper search_path)
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT restaurant_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.i_own_restaurant(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND owner_id = auth.uid()
  );
$$;

-- Restaurant policies
CREATE POLICY "restaurant_select_owner"
  ON restaurants FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "restaurant_select_employee"
  ON restaurants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND restaurant_id = restaurants.id
    )
  );

CREATE POLICY "restaurant_insert"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "restaurant_update"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "restaurant_delete"
  ON restaurants FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Teams policies
CREATE POLICY "team_select"
  ON teams FOR SELECT
  TO authenticated
  USING (
    public.i_own_restaurant(restaurant_id) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND restaurant_id = teams.restaurant_id
    )
  );

CREATE POLICY "team_insert"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (public.i_own_restaurant(restaurant_id));

CREATE POLICY "team_update"
  ON teams FOR UPDATE
  TO authenticated
  USING (public.i_own_restaurant(restaurant_id))
  WITH CHECK (public.i_own_restaurant(restaurant_id));

CREATE POLICY "team_delete"
  ON teams FOR DELETE
  TO authenticated
  USING (public.i_own_restaurant(restaurant_id));

-- Team members policies
CREATE POLICY "team_member_select_own"
  ON team_members FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "team_member_select_restaurant"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      JOIN profiles p ON p.restaurant_id = t.restaurant_id
      WHERE t.id = team_members.team_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "team_member_insert"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND public.i_own_restaurant(t.restaurant_id)
    )
  );

CREATE POLICY "team_member_update"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND public.i_own_restaurant(t.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND public.i_own_restaurant(t.restaurant_id)
    )
  );

CREATE POLICY "team_member_delete"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND public.i_own_restaurant(t.restaurant_id)
    )
  );

-- Profile policies for restaurant management
CREATE POLICY "profile_update_by_owner"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id != auth.uid() 
    AND restaurant_id IS NOT NULL
    AND public.i_own_restaurant(restaurant_id)
  )
  WITH CHECK (
    id != auth.uid()
    AND (
      (restaurant_id IS NOT NULL AND public.i_own_restaurant(restaurant_id))
      OR (restaurant_id IS NULL)
    )
  );

-- Functions for restaurant exit and deletion
CREATE OR REPLACE FUNCTION leave_restaurant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_restaurant_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, restaurant_id INTO v_user_role, v_restaurant_id
  FROM profiles WHERE id = v_user_id;

  IF v_user_role != 'employee' THEN
    RAISE EXCEPTION 'Only employees can leave restaurants';
  END IF;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'You are not part of any restaurant';
  END IF;

  DELETE FROM team_members WHERE profile_id = v_user_id;

  UPDATE profiles
  SET restaurant_id = NULL, role = 'owner', updated_at = now()
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_restaurant(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM restaurants WHERE id = p_restaurant_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  IF v_owner_id != v_user_id THEN
    RAISE EXCEPTION 'Only the restaurant owner can delete the restaurant';
  END IF;

  UPDATE profiles
  SET restaurant_id = NULL, role = 'owner', updated_at = now()
  WHERE restaurant_id = p_restaurant_id;

  DELETE FROM restaurants WHERE id = p_restaurant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION leave_restaurant() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_restaurant(uuid) TO authenticated;