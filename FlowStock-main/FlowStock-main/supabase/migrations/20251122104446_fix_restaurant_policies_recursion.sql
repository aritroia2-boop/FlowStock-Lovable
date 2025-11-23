/*
  # Fix Infinite Recursion in Restaurant and Profile Policies

  ## Problem
  The previous policies created a circular dependency:
  - Restaurant INSERT checks profile data
  - Profile SELECT checks restaurant data
  - This causes infinite recursion during restaurant creation

  ## Solution
  1. Drop all existing problematic policies on restaurants and profiles
  2. Create simplified policies that avoid circular references
  3. Allow restaurant creation without checking profile's restaurant_id
  4. Use direct auth.uid() checks instead of subqueries where possible

  ## Changes
  - Remove policies that cause recursion
  - Add simplified policies for restaurant CRUD operations
  - Update profile policies to avoid circular restaurant lookups
  - Ensure authenticated users can create restaurants as owners
*/

-- Drop all existing policies on restaurants table
DROP POLICY IF EXISTS "Owners can view own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Employees can view their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can create restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can update own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can delete own restaurant" ON restaurants;

-- Drop problematic policies on profiles table
DROP POLICY IF EXISTS "Users can view profiles in their restaurant" ON profiles;
DROP POLICY IF EXISTS "Owners can update employee profiles" ON profiles;

-- ============================================
-- NEW SIMPLIFIED RESTAURANT POLICIES
-- ============================================

-- Policy: Any authenticated user can create a restaurant where they are the owner
CREATE POLICY "Authenticated users can create restaurant as owner"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can view restaurants they own
CREATE POLICY "Users can view own restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policy: Users can view restaurants they are associated with via their profile
-- This uses a direct profile lookup without recursion
CREATE POLICY "Users can view their associated restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.restaurant_id = restaurants.id
    )
  );

-- Policy: Owners can update their own restaurant
CREATE POLICY "Owners can update own restaurant"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Owners can delete their own restaurant
CREATE POLICY "Owners can delete own restaurant"
  ON restaurants FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ============================================
-- UPDATED PROFILE POLICIES (NON-RECURSIVE)
-- ============================================

-- Policy: Users can view their own profile (always allowed)
CREATE POLICY "Users can view own profile direct"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Users can view other profiles in the same restaurant
-- This checks restaurant_id directly without querying restaurants table
CREATE POLICY "Users can view same restaurant profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    restaurant_id IS NOT NULL 
    AND restaurant_id = (
      SELECT restaurant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Restaurant owners can update profiles associated with their restaurant
-- This checks ownership via the restaurants table owner_id
CREATE POLICY "Restaurant owners can update employee profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id != auth.uid() 
    AND restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    id != auth.uid() 
    AND restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile direct"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());