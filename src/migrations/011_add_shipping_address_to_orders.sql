-- Add shipping_address and notes columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for faster shipping lookups (optional)
CREATE INDEX IF NOT EXISTS idx_orders_shipping_country 
ON orders ((shipping_address->>'country'));