/*
  # Fix Function Search Path Issues and Create Storage Bucket
  
  Fixes remaining function security warnings and sets up recipe images storage.
*/

-- Fix handle_new_user function (already has search_path set, but let's ensure it)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(new.email, '@', 1),
      'User'
    ),
    LOWER(TRIM(new.email)),
    'owner'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    updated_at = now();

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix set_default_owner_role function
CREATE OR REPLACE FUNCTION set_default_owner_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NULL OR NEW.role = 'none' THEN
    NEW.role := 'owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create recipe-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for recipe images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload recipe images'
  ) THEN
    CREATE POLICY "Authenticated users can upload recipe images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'recipe-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can read recipe images'
  ) THEN
    CREATE POLICY "Public can read recipe images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'recipe-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update recipe images'
  ) THEN
    CREATE POLICY "Authenticated users can update recipe images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'recipe-images')
    WITH CHECK (bucket_id = 'recipe-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete recipe images'
  ) THEN
    CREATE POLICY "Authenticated users can delete recipe images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'recipe-images');
  END IF;
END $$;