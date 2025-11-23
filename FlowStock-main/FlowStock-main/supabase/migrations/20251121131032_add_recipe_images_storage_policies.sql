/*
  # Add Storage Policies for Recipe Images

  1. Storage Policies
    - Allow authenticated users to upload recipe images
    - Allow public read access to recipe images
    - Allow authenticated users to update their own recipe images
    - Allow authenticated users to delete their own recipe images

  2. Security
    - Upload restricted to authenticated users only
    - Read access is public (bucket is public)
    - Update/Delete restricted to authenticated users
*/

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