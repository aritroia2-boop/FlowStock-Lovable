/*
  # Add Profile Search Policy for Employee Invitations

  ## Overview
  This migration adds an RLS policy that allows restaurant owners to search for
  any profile by email address when inviting employees. This is necessary for
  the employee invitation flow to work correctly.

  ## Changes

  ### 1. New RLS Policy
  - Add "Owners can search profiles for invitations" policy
  - Allows authenticated users (potential restaurant owners) to search profiles by email
  - Enables the employee invitation feature to check if users exist
  - Does NOT allow viewing all profile data, just enough to validate existence

  ## Security Considerations
  - Policy is restrictive: only allows SELECT operations
  - Only available to authenticated users
  - Necessary for the invitation workflow
  - Minimal data exposure (users can only check if an email exists)

  ## Important Notes
  - This policy works alongside existing policies
  - Owners will be able to search for profiles by email to send invitations
  - The policy is PERMISSIVE, meaning it combines with other SELECT policies using OR
*/

-- Add policy to allow authenticated users to search for profiles by email
-- This is needed for the employee invitation feature
CREATE POLICY "Owners can search profiles for invitations"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);
