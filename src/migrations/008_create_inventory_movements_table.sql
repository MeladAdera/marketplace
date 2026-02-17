-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL, -- يمكن أن يكون سالب أو موجب
    reason TEXT,
    related_vendor_order_id UUID REFERENCES vendor_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_movement_type CHECK (type IN ('reserve', 'release', 'restock', 'manual_adjustment'))
);

-- Create indexes
CREATE INDEX idx_inventory_movements_variant_id ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_movements_organization_id ON inventory_movements(organization_id);
CREATE INDEX idx_inventory_movements_actor_user_id ON inventory_movements(actor_user_id);
CREATE INDEX idx_inventory_movements_related_order_id ON inventory_movements(related_vendor_order_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(type);