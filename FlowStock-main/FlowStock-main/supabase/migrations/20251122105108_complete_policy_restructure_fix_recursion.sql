/*
  # Complete Policy Restructure - Fix All Recursion Issues

  ## Problem
  Multiple layers of policies have been created that cause infinite recursion:
  - Profile SELECT policies query the profiles table recursively
  - Restaurant SELECT policies query profiles, which triggers profile policies
  - This creates circular dependencies that Postgres detects as infinite recursion

  ## Solution
  1. Create security definer helper functions that bypass RLS
  2. Drop ALL existing policies on profiles and restaurants tables
  3. Create simple, non-recursive policies using direct checks only
  4. Avoid ANY subqueries to RLS-protected tables within policy conditions

  ## Changes
  - Add security definer function to get user's restaurant_id without triggering RLS
  - Drop all problematic policies from all previous migrations
  - Create clean policies that never query the same table recursively
  - Ensure restaurant creation works without triggering profile SELECT policies
*/

-- ============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================

-- Function to get current user's restaurant_id without triggering RLS
-- This bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_restaurant_id uuid;
BEGIN
  SELECT restaurant_id INTO user_restaurant_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_restaurant_id;
END;
$$;

-- Function to check if current user owns a restaurant
CREATE OR REPLACE FUNCTION public.i_own_restaurant(restaurant_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = restaurant_uuid
    AND owner_id = auth.uid()
  ) INTO is_owner;
  
  RETURN is_owner;
END;
$$;

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- Drop all policies on restaurants table
DROP POLICY IF EXISTS "Owners can view own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Employees can view their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can create restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can update own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can delete own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Authenticated users can create restaurant as owner" ON restaurants;
DROP POLICY IF EXISTS "Users can view own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Users can view their associated restaurant" ON restaurants;

-- Drop all policies on profiles table
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their restaurant" ON profiles;
DROP POLICY IF EXISTS "Owners can update employee profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile direct" ON profiles;
DROP POLICY IF EXISTS "Users can view same restaurant profiles" ON profiles;
DROP POLICY IF EXISTS "Restaurant owners can update employee profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile direct" ON profiles;

-- ============================================
-- NEW PROFILE POLICIES (NON-RECURSIVE)
-- ============================================

-- Policy 1: Users can always view their own profile
-- This is the ONLY policy needed for self-access
CREATE POLICY "profile_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Users can view profiles in the same restaurant
-- Uses the security definer function to avoid recursion
CREATE POLICY "profile_select_same_restaurant"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND restaurant_id = public.get_my_restaurant_id()
  );

-- Policy 3: Users can update their own profile
CREATE POLICY "profile_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 4: Restaurant owners can update employee profiles
-- Direct check: the employee's restaurant_id must be a restaurant I own
CREATE POLICY "profile_update_employees"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id != auth.uid() 
    AND restaurant_id IS NOT NULL
    AND public.i_own_restaurant(restaurant_id)
  )
  WITH CHECK (
    id != auth.uid() 
    AND restaurant_id IS NOT NULL
    AND public.i_own_restaurant(restaurant_id)
  );

-- ============================================
-- NEW RESTAURANT POLICIES (NON-RECURSIVE)
-- ============================================

-- Policy 1: Any authenticated user can create a restaurant as owner
-- Simple check: no subqueries, no recursion
CREATE POLICY "restaurant_insert_as_owner"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Policy 2: Users can view restaurants they own
-- Direct check on owner_id column
CREATE POLICY "restaurant_select_own"
  ON restaurants FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policy 3: Users can view their assigned restaurant
-- Uses security definer function to avoid recursion
CREATE POLICY "restaurant_select_assigned"
  ON restaurants FOR SELECT
  TO authenticated
  USING (
    id = public.get_my_restaurant_id()
  );

-- Policy 4: Owners can update their own restaurant
CREATE POLICY "restaurant_update_own"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 5: Owners can delete their own restaurant
CREATE POLICY "restaurant_delete_own"
  ON restaurants FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ============================================
-- GRANT EXECUTE ON HELPER FUNCTIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.get_my_restaurant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.i_own_restaurant(uuid) TO authenticated;