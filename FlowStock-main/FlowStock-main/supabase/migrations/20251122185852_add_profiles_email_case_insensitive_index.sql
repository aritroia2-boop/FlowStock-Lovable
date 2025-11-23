/*
  # Add Case-Insensitive Email Index to Profiles Table

  ## Overview
  This migration adds a functional index on the profiles table to enable fast,
  case-insensitive email lookups. This prevents issues where users exist but
  aren't found due to case mismatches (e.g., "User@Email.com" vs "user@email.com").

  ## Changes

  ### 1. Indexes
  - Add case-insensitive email index using LOWER(email)
  - Improves performance for email lookups
  - Ensures consistent email matching regardless of case

  ## Benefits
  - Faster email lookups across the application
  - Prevents "user not found" errors due to case sensitivity
  - Enables efficient queries using WHERE LOWER(email) = LOWER(...)
  - Improves team invitation reliability

  ## Important Notes
  - Uses functional index on LOWER(email)
  - All email queries should use LOWER() for both sides of comparison
  - Index is created with IF NOT EXISTS for safe re-runs
*/

-- Create case-insensitive email index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower 
  ON profiles(LOWER(email));

-- Add regular email index if not exists (for exact matches)
CREATE INDEX IF NOT EXISTS idx_profiles_email 
  ON profiles(email);