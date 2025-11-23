/*
  # Add Storage Policies for Recipe Images

  ## Overview
  This migration creates the necessary Row Level Security policies for the recipe-images
  storage bucket to control access permissions.

  ## Changes

  ### 1. Storage Policies
  - Allow authenticated users to upload recipe images
  - Allow public read access to recipe images
  - Allow authenticated users to update recipe images
  - Allow authenticated users to delete recipe images

  ### 2. Security
  - Upload restricted to authenticated users only
  - Read access is public (bucket is public)
  - Update/Delete restricted to authenticated users

  ## Important Notes
  - Bucket must exist before policies can be created (see create_recipe_images_storage_bucket migration)
  - Policies reference bucket_id = 'recipe-images'
  - Uses DROP POLICY IF EXISTS for safe re-runs
*/

-- Drop existing policies if they exist (for safe re-runs)
DROP POLICY IF EXISTS "Authenticated users can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Public can read recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete recipe images" ON storage.objects;

-- Policy to allow authenticated users to upload recipe images
CREATE POLICY "Authenticated users can upload recipe images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images');

-- Policy to allow public read access to recipe images
CREATE POLICY "Public can read recipe images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recipe-images');

-- Policy to allow authenticated users to update recipe images
CREATE POLICY "Authenticated users can update recipe images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'recipe-images')
WITH CHECK (bucket_id = 'recipe-images');

-- Policy to allow authenticated users to delete recipe images
CREATE POLICY "Authenticated users can delete recipe images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'recipe-images');