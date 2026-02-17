-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL,
    total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
    client_request_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_order_status CHECK (status IN ('pending_payment', 'paid', 'cancelled'))
);

-- Create vendor_orders table
CREATE TABLE IF NOT EXISTS vendor_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL,
    subtotal_amount_cents INTEGER NOT NULL CHECK (subtotal_amount_cents >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_vendor_order_status CHECK (status IN ('pending', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded')),
    CONSTRAINT unique_order_vendor UNIQUE (order_id, vendor_organization_id)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_order_id UUID NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_snapshot_cents INTEGER NOT NULL CHECK (price_snapshot_cents >= 0),
    sku_snapshot VARCHAR(100) NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for orders
CREATE INDEX idx_orders_customer_user_id ON orders(customer_user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_client_request_id ON orders(client_request_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Create indexes for vendor_orders
CREATE INDEX idx_vendor_orders_order_id ON vendor_orders(order_id);
CREATE INDEX idx_vendor_orders_vendor_org_id ON vendor_orders(vendor_organization_id);
CREATE INDEX idx_vendor_orders_status ON vendor_orders(status);

-- Create indexes for order_items
CREATE INDEX idx_order_items_vendor_order_id ON order_items(vendor_order_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

-- Create triggers
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_orders_updated_at 
    BEFORE UPDATE ON vendor_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();