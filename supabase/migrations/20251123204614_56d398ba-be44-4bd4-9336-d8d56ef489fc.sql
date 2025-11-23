-- Add price_per_unit column to ingredients table
ALTER TABLE ingredients 
ADD COLUMN IF NOT EXISTS price_per_unit numeric DEFAULT 0 CHECK (price_per_unit >= 0);

-- Add comment for documentation
COMMENT ON COLUMN ingredients.price_per_unit IS 'Price per unit in lei (must be non-negative)';

-- Update existing ingredients to have 0 as default price
UPDATE ingredients SET price_per_unit = 0 WHERE price_per_unit IS NULL;