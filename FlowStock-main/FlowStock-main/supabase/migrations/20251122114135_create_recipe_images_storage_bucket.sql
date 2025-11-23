/*
  # Create Recipe Images Storage Bucket

  ## Overview
  This migration creates the storage bucket for recipe images that the application
  references. The bucket must exist before the storage policies can function properly.

  ## Changes

  ### 1. Storage Bucket Creation
  - Creates `recipe-images` bucket
  - Configured as public (allows public read access to images)
  - File size limit: 5MB (5,242,880 bytes)
  - Allowed MIME types: JPEG, JPG, PNG, WEBP, GIF

  ### 2. Configuration Details
  - **Bucket ID**: `recipe-images`
  - **Public Access**: `true` - Required for displaying images in the application
  - **File Size Limit**: 5MB - Matches application-side validation
  - **MIME Types**: Only image formats allowed for security

  ## Important Notes
  - This migration should run BEFORE the policies migration (20251121131032)
  - Uses ON CONFLICT DO NOTHING to safely handle re-runs
  - Bucket is public to allow image display without authentication
  - Policies control upload/delete permissions (authenticated users only)

  ## Security
  - Upload restricted via policies (authenticated users)
  - Public read access for image display
  - File type validation via allowed_mime_types
  - File size limit prevents abuse
*/

-- Create the recipe-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;