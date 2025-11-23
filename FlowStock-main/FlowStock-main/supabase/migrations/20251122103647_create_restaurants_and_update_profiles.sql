/*
  # Create restaurants table and update profiles for multi-restaurant system

  1. New Tables
    - `restaurants`
      - `id` (uuid, primary key)
      - `name` (text, restaurant name)
      - `address` (text, restaurant address)
      - `phone` (text, restaurant phone number)
      - `logo_url` (text, optional logo image URL)
      - `owner_id` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications to profiles table
    - Add `role` column (text, default 'none') - values: 'owner', 'employee', 'none'
    - Add `restaurant_id` (uuid, nullable, foreign key to restaurants)
  
  3. Security
    - Enable RLS on restaurants table
    - Add policies for restaurant owners to manage their restaurant
    - Add policies for employees to view their restaurant
    - Update profiles policies to support role-based access
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

-- Add role and restaurant_id to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Policies for restaurants table

-- Restaurant owners can view their own restaurant
CREATE POLICY "Owners can view own restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Restaurant employees can view their restaurant
CREATE POLICY "Employees can view their restaurant"
  ON restaurants FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT restaurant_id FROM profiles 
      WHERE id = auth.uid() AND restaurant_id IS NOT NULL
    )
  );

-- Owners can create restaurants
CREATE POLICY "Owners can create restaurant"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own restaurant
CREATE POLICY "Owners can update own restaurant"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Owners can delete their own restaurant
CREATE POLICY "Owners can delete own restaurant"
  ON restaurants FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Update profiles policies to allow owners to view and update employee profiles

-- Allow users to view profiles in their restaurant
CREATE POLICY "Users can view profiles in their restaurant"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Allow owners to update employee profiles (role and restaurant_id)
CREATE POLICY "Owners can update employee profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );