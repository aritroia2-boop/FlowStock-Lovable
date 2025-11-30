-- Add subscription-related fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_subscribed IS 'Whether user has an active subscription';
COMMENT ON COLUMN profiles.is_admin IS 'Admin bypass flag - set manually by owner only';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID from checkout';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN profiles.subscription_status IS 'active, canceled, past_due, unpaid, or none';