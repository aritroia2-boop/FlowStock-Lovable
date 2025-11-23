-- Add category column to recipes table
ALTER TABLE recipes ADD COLUMN category TEXT DEFAULT 'Main Courses';