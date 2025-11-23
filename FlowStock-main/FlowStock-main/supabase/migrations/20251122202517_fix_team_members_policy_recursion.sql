/*
  # Fix Infinite Recursion in Team Members Policy

  ## Problem
  The "Employees can view their team members" policy on the team_members table
  was causing infinite recursion because it queried the team_members table
  within its own policy condition.

  ## Changes
  1. Drop the problematic recursive policy for employees viewing team members
  2. Create a new non-recursive policy that checks through teams and profiles tables
  
  ## Security
  - Owners can still view all team members (existing policy unchanged)
  - Employees can view team members in their restaurant without recursion
  - Users can always see their own team memberships

  ## Important Notes
  - This fixes the "infinite recursion detected in policy" error
  - The fix avoids querying team_members within the team_members policy
  - All existing owner policies remain unchanged and functional
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Employees can view their team members" ON team_members;

-- Create a new non-recursive policy for employees
CREATE POLICY "Employees can view their team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    -- User can see their own membership
    team_members.profile_id = auth.uid()
    OR
    -- User can see other members if they're in the same restaurant
    EXISTS (
      SELECT 1 FROM teams t
      JOIN profiles p ON p.restaurant_id = t.restaurant_id
      WHERE t.id = team_members.team_id
      AND p.id = auth.uid()
      AND p.role = 'employee'
    )
  );
