-- HoReCa Inventory Management System - Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Create ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL,
  minimum_stock numeric NOT NULL DEFAULT 0,
  category text DEFAULT '',
  supplier text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create recipe_ingredients junction table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  operation text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  user_name text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Allow public read on ingredients"
  ON ingredients FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on ingredients"
  ON ingredients FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on ingredients"
  ON ingredients FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on ingredients"
  ON ingredients FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read on recipes"
  ON recipes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on recipes"
  ON recipes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on recipes"
  ON recipes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on recipes"
  ON recipes FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read on recipe_ingredients"
  ON recipe_ingredients FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on recipe_ingredients"
  ON recipe_ingredients FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on recipe_ingredients"
  ON recipe_ingredients FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on recipe_ingredients"
  ON recipe_ingredients FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read on audit_logs"
  ON audit_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on audit_logs"
  ON audit_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Insert sample data
INSERT INTO ingredients (name, quantity, unit, minimum_stock, category, supplier) VALUES
  ('Chicken Breast', 150, 'kg', 100, 'Meat', 'Fresh Foods Inc'),
  ('Tomatoes (Roma)', 20, 'boxes', 10, 'Vegetables', 'Local Farm'),
  ('Olive Oil (Extra Virgin)', 75, 'liters', 10, 'Oils', 'Mediterranean Imports'),
  ('Salmon Fillet', 30, 'kg', 15, 'Fish', 'Ocean Fresh'),
  ('Flour (All-Purpose)', 200, 'kg', 100, 'Dry Goods', 'Baker Supply Co')
ON CONFLICT DO NOTHING;

INSERT INTO recipes (name, category, cost) VALUES
  ('Classic Margherita Pizza', 'Appetizers', 8.50),
  ('Spoily Mostiral Pizza', 'Main Courses', 12.50),
  ('Spicy Chicken Tacos', 'Main Courses', 10.75),
  ('Epoc', 'Main Courses', 12.50),
  ('Main onad', 'Main Courses', 12.50)
ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (ingredient_name, operation, amount, user_name, timestamp) VALUES
  ('Tomatoes', 'Added', 50, 'user_john', '2023-10-26 10:00:00'),
  ('Flour', 'Removed', 10, 'user_mary', '2023-10-26 09:30:00'),
  ('Olive Oil', 'Adjusted', 20, '11:30_john', '2023-10-26 10:00:00'),
  ('Chicken Breast', 'Removed', 30, 'user_susan', '2023-10-26 11:00:00'),
  ('Salt', 'Added', 100, '12:0avid', '2023-10-26 12:00:00')
ON CONFLICT DO NOTHING;
