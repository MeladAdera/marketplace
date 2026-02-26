// src/repository/cart.repo.ts
import pool from "../db/database";
import { 
  CartItem, 
  CartItemWithDetails, 
  AddToCartInput, 
  UpdateCartItemInput,
  CartResponse 
} from "../types/cart.types";

/**
 * Get or create cart for user (lazy cart creation)
 */
export async function getOrCreateCart(userId: string): Promise<string> {
  const result = await pool.query(
    `
    INSERT INTO carts (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING id
    `,
    [userId]
  );
  return result.rows[0].id;
}

/**
 * Add item to cart (upsert if variant already exists)
 * 🔒 Validates variant exists + is active + has stock
 */
export async function addToCart(
  userId: string,
  { variantId, quantity }: AddToCartInput
): Promise<CartItemWithDetails> {
  const cartId = await getOrCreateCart(userId);

  // First, validate variant exists, is active, and has sufficient stock
  const variantCheck = await pool.query(
    `
    SELECT 
      v.id,
      v.stock_quantity,
      v.active,
      p.organization_id
    FROM variants v
    INNER JOIN products p ON v.product_id = p.id
    WHERE v.id = $1 
      AND v.active = TRUE 
      AND p.active = TRUE 
      AND p.soft_deleted_at IS NULL
    `,
    [variantId]
  );

  if (variantCheck.rows.length === 0) {
    throw new Error("VARIANT_NOT_FOUND_OR_INACTIVE");
  }

  const variant = variantCheck.rows[0];
  if (quantity > variant.stock_quantity) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  // Upsert cart item (UNIQUE constraint on cart_id + variant_id)
  const result = await pool.query(
    `
    INSERT INTO cart_items (cart_id, variant_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (cart_id, variant_id) 
    DO UPDATE SET 
      quantity = cart_items.quantity + $3,
      updated_at = NOW()
    RETURNING id, cart_id, variant_id, quantity, created_at, updated_at
    `,
    [cartId, variantId, quantity]
  );

  // Fetch full details with product + organization info
  return await getCartItemWithDetails(result.rows[0].id, userId);
}

/**
 * Get single cart item with full details (for response)
 */
async function getCartItemWithDetails(
  cartItemId: string,
  userId: string
): Promise<CartItemWithDetails> {
  const result = await pool.query(
    `
    SELECT 
      ci.id,
      ci.cart_id,
      ci.variant_id,
      ci.quantity,
      ci.created_at,
      ci.updated_at,
      -- Variant details
      v.sku,
      v.name as variant_name,
      v.price_cents,
      v.stock_quantity,
      v.active as variant_active,
      -- Product details
      p.id as product_id,
      p.name as product_name,
      p.organization_id,
      -- Organization (vendor) details
      o.id as vendor_id,
      o.name as vendor_name,
      o.slug as vendor_slug
    FROM cart_items ci
    INNER JOIN variants v ON ci.variant_id = v.id
    INNER JOIN products p ON v.product_id = p.id
    INNER JOIN organizations o ON p.organization_id = o.id
    INNER JOIN carts c ON ci.cart_id = c.id
    WHERE ci.id = $1 
      AND c.user_id = $2
      AND v.active = TRUE
      AND p.active = TRUE
      AND p.soft_deleted_at IS NULL
    `,
    [cartItemId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error("CART_ITEM_NOT_FOUND");
  }

  const row = result.rows[0];
  return {
    id: row.id,
    cartId: row.cart_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variant: {
      id: row.variant_id,
      sku: row.sku,
      name: row.variant_name,
      priceCents: row.price_cents,
      stockQuantity: row.stock_quantity,
      active: row.variant_active,
      product: {
        id: row.product_id,
        name: row.product_name,
        organizationId: row.organization_id,
        organization: {
          id: row.vendor_id,
          name: row.vendor_name,
          slug: row.vendor_slug,
        },
      },
    },
  };
}

/**
 * Get user's full cart grouped by vendor (for display + checkout prep)
 */
export async function getUserCartGroupedByVendor(
  userId: string
): Promise<CartResponse & { itemsByVendor: Record<string, CartItemWithDetails[]> }> {
  // Get cart ID first
  const cartResult = await pool.query(
    `SELECT id FROM carts WHERE user_id = $1`,
    [userId]
  );
  
  if (cartResult.rows.length === 0) {
    // Return empty cart structure
    return {
      id: '',
      items: [],
      itemsByVendor: {},
      totalItems: 0,
      totalPriceCents: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const cartId = cartResult.rows[0].id;

  // Fetch all cart items with details
  const result = await pool.query(
    `
    SELECT 
      ci.id,
      ci.cart_id,
      ci.variant_id,
      ci.quantity,
      ci.created_at,
      ci.updated_at,
      -- Variant
      v.sku,
      v.name as variant_name,
      v.price_cents,
      v.stock_quantity,
      v.active as variant_active,
      -- Product
      p.id as product_id,
      p.name as product_name,
      p.organization_id,
      -- Vendor (Organization)
      o.id as vendor_id,
      o.name as vendor_name,
      o.slug as vendor_slug
    FROM cart_items ci
    INNER JOIN variants v ON ci.variant_id = v.id
    INNER JOIN products p ON v.product_id = p.id
    INNER JOIN organizations o ON p.organization_id = o.id
    WHERE ci.cart_id = $1
      AND v.active = TRUE
      AND p.active = TRUE
      AND p.soft_deleted_at IS NULL
      AND o.status = 'active'
    ORDER BY o.name, p.name
    `,
    [cartId]
  );

  // Transform rows to CartItemWithDetails[]
  const items: CartItemWithDetails[] = result.rows.map((row): CartItemWithDetails => ({
    id: row.id,
    cartId: row.cart_id,
    variantId: row.variant_id,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variant: {
      id: row.variant_id,
      sku: row.sku,
      name: row.variant_name,
      priceCents: row.price_cents,
      stockQuantity: row.stock_quantity,
      active: row.variant_active,
      product: {
        id: row.product_id,
        name: row.product_name,
        organizationId: row.organization_id,
        organization: {
          id: row.vendor_id,
          name: row.vendor_name,
          slug: row.vendor_slug,
        },
      },
    },
  }));

  // Group by vendor_id
  const itemsByVendor: Record<string, CartItemWithDetails[]> = {};
  let totalPriceCents = 0;
  let totalItems = 0;

  for (const item of items) {
    const vendorId = item.variant.product.organizationId;
    if (!itemsByVendor[vendorId]) {
      itemsByVendor[vendorId] = [];
    }
    itemsByVendor[vendorId].push(item);
    totalPriceCents += item.variant.priceCents * item.quantity;
    totalItems += item.quantity;
  }

  // Get cart timestamps
  const cartInfo = await pool.query(
    `SELECT id, created_at, updated_at FROM carts WHERE id = $1`,
    [cartId]
  );
  const cart = cartInfo.rows[0];

  return {
    id: cartId,
    items,
    itemsByVendor,
    totalItems,
    totalPriceCents,
    createdAt: cart.created_at,
    updatedAt: cart.updated_at,
  };
}

/**
 * Update cart item quantity
 */
export async function updateCartItem(
  userId: string,
  cartItemId: string,
  { quantity }: UpdateCartItemInput
): Promise<CartItemWithDetails> {
  if (quantity < 1) {
    throw new Error("QUANTITY_MUST_BE_POSITIVE");
  }

  // First, verify this cart item belongs to the user and get variant info
  const checkResult = await pool.query(
    `
    SELECT 
      ci.id,
      ci.variant_id,
      v.stock_quantity,
      v.active as variant_active,
      p.active as product_active,
      p.soft_deleted_at
    FROM cart_items ci
    INNER JOIN variants v ON ci.variant_id = v.id
    INNER JOIN products p ON v.product_id = p.id
    INNER JOIN carts c ON ci.cart_id = c.id
    WHERE ci.id = $1 AND c.user_id = $2
    `,
    [cartItemId, userId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error("CART_ITEM_NOT_FOUND");
  }

  const item = checkResult.rows[0];
  
  // Re-validate stock
  if (!item.variant_active || !item.product_active || item.soft_deleted_at) {
    throw new Error("ITEM_NO_LONGER_AVAILABLE");
  }
  
  if (quantity > item.stock_quantity) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  // Update quantity
  const updateResult = await pool.query(
    `
    UPDATE cart_items
    SET quantity = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, cart_id, variant_id, quantity, created_at, updated_at
    `,
    [quantity, cartItemId]
  );

  return await getCartItemWithDetails(updateResult.rows[0].id, userId);
}

/**
 * Remove item from cart
 */
export async function removeCartItem(
  userId: string,
  cartItemId: string
): Promise<boolean> {
  const result = await pool.query(
    `
    DELETE FROM cart_items
    WHERE id = $1 
      AND cart_id IN (SELECT id FROM carts WHERE user_id = $2)
    RETURNING id
    `,
    [cartItemId, userId]
  );
  
  return result.rows.length > 0;
}

/**
 * Clear entire cart for user
 */
export async function clearCart(userId: string): Promise<number> {
  const result = await pool.query(
    `
    DELETE FROM cart_items
    WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1)
    RETURNING id
    `,
    [userId]
  );
  
  return result.rows.length;
}