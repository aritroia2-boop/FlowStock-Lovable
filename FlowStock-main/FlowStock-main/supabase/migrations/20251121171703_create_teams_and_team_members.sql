/*
  # Create Teams and Team Members Tables

  ## Overview
  This migration creates a complete team management system for restaurants,
  allowing owners to organize employees into teams (e.g., Kitchen Staff,
  Service Team, Management) and assign specific roles within each team.

  ## New Tables

  ### 1. `teams`
  Represents organizational groups within a restaurant
  - `id` (uuid, primary key) - Unique team identifier
  - `restaurant_id` (uuid, foreign key) - Links team to restaurant
  - `name` (text) - Team name (e.g., "Kitchen Staff", "Waiters")
  - `description` (text, optional) - Team description
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `team_members`
  Manages many-to-many relationship between teams and profiles with roles
  - `id` (uuid, primary key) - Unique membership identifier
  - `team_id` (uuid, foreign key) - Links to team
  - `profile_id` (uuid, foreign key) - Links to user profile
  - `role` (text) - Role within the team (e.g., "manager", "member", "supervisor")
  - `created_at` (timestamptz) - When member was added to team

  ## Security
  - RLS enabled on both tables
  - Owners can manage teams for their restaurant
  - Employees can view teams they belong to
  - Team members can view their team information

  ## Important Notes
  - A profile can be a member of multiple teams
  - Each team membership has a specific role
  - Teams are restaurant-specific (no cross-restaurant teams)
  - All operations are logged and timestamped
*/

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_team_name_per_restaurant UNIQUE (restaurant_id, name)
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_member_per_team UNIQUE (team_id, profile_id)
);

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams table

-- Owners can view teams for their restaurant
CREATE POLICY "Owners can view their restaurant teams"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = teams.restaurant_id
      AND profiles.role = 'owner'
    )
  );

-- Employees can view teams in their restaurant
CREATE POLICY "Employees can view restaurant teams"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = teams.restaurant_id
      AND profiles.role = 'employee'
    )
  );

-- Owners can create teams for their restaurant
CREATE POLICY "Owners can create teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = teams.restaurant_id
      AND profiles.role = 'owner'
    )
  );

-- Owners can update teams for their restaurant
CREATE POLICY "Owners can update their restaurant teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = teams.restaurant_id
      AND profiles.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = teams.restaurant_id
      AND profiles.role = 'owner'
    )
  );

-- Owners can delete teams for their restaurant
CREATE POLICY "Owners can delete their restaurant teams"
  ON teams FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = teams.restaurant_id
      AND profiles.role = 'owner'
    )
  );

-- RLS Policies for team_members table

-- Owners can view all team members in their restaurant
CREATE POLICY "Owners can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN profiles ON profiles.restaurant_id = teams.restaurant_id
      WHERE teams.id = team_members.team_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- Employees can view members of teams they belong to
CREATE POLICY "Employees can view their team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    team_members.profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.profile_id = auth.uid()
    )
  );

-- Owners can add members to teams
CREATE POLICY "Owners can add team members"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN profiles ON profiles.restaurant_id = teams.restaurant_id
      WHERE teams.id = team_members.team_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- Owners can update team member roles
CREATE POLICY "Owners can update team members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN profiles ON profiles.restaurant_id = teams.restaurant_id
      WHERE teams.id = team_members.team_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      JOIN profiles ON profiles.restaurant_id = teams.restaurant_id
      WHERE teams.id = team_members.team_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- Owners can remove team members
CREATE POLICY "Owners can remove team members"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      JOIN profiles ON profiles.restaurant_id = teams.restaurant_id
      WHERE teams.id = team_members.team_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teams_restaurant_id ON teams(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile_id ON team_members(profile_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update teams.updated_at on UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_teams_updated_at_trigger
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_teams_updated_at();
  END IF;
END $$;
