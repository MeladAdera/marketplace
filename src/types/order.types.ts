// src/types/order.types.ts
import { User } from './user.types';
import { Organization } from './organization.types';
type UUID = string; 

// ─────────────────────────────────────────────────────────────
// Status Types (unchanged - perfect!)
// ─────────────────────────────────────────────────────────────
export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled';
export type VendorOrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'packed' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

// ─────────────────────────────────────────────────────────────
// Core Domain Entities (unchanged - perfect!)
// ─────────────────────────────────────────────────────────────
export interface Order {
  id: UUID;
  orderNumber: string;
  customerUserId: UUID;
  status: OrderStatus;
  totalAmountCents: number;
  clientRequestId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorOrder {
  id: UUID;
  orderId: UUID;
  vendorOrganizationId: UUID;
  status: VendorOrderStatus;
  subtotalAmountCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: UUID;
  vendorOrderId: UUID;
  variantId: UUID;
  quantity: number;
  priceSnapshotCents: number;
  skuSnapshot: string;
  productNameSnapshot: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// 🔹 API REQUEST TYPES (What the client sends)
// ─────────────────────────────────────────────────────────────

/**
 * POST /orders - Checkout Request Body
 * This is what the frontend sends during checkout
 */
export interface CheckoutRequest {
  /** Idempotency key: client-generated unique string to prevent duplicate orders */
  client_request_id: string;
  
  /** Payment method identifier (Phase 5: only "fake" is supported) */
  payment_method: 'fake';
  
  /** Shipping address for the order */
  shipping_address: {
    recipient_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
    phone?: string;
  };
  
  /** Optional: customer notes visible to vendors */
  notes?: string;
}

/**
 * POST /orders/:id/refund - Refund Request Body
 */
export interface RefundRequest {
  /** Reason for refund (required for audit) */
  reason: string;
  
  /** Optional: if true, restock the inventory items */
  restock_inventory?: boolean;
}

// ─────────────────────────────────────────────────────────────
// 🔹 API RESPONSE TYPES (What we send back to client)
// ─────────────────────────────────────────────────────────────

/**
 * POST /orders - Success Response
 */
export interface CheckoutResponse {
  success: true;
  data: OrderWithDetailsResponse;
  message?: string;
}

/**
 * GET /orders - List Response (paginated)
 */
export interface OrderListResponse {
  success: true;
  data: {
    orders: OrderSummaryResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * GET /orders/:id - Detailed Order Response
 */
export interface OrderWithDetailsResponse {
  id: UUID;
  orderNumber: string;
  status: OrderStatus;
  totalAmountCents: number;
  clientRequestId: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Customer info
  customer: Pick<User, 'id' | 'email'>;
  
  // Shipping & notes
  shippingAddress: {
    recipient_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
    phone?: string;
  };
  notes?: string;
  
  // Vendor sub-orders with items
  vendorOrders: VendorOrderWithItemsResponse[];
}

/**
 * Summary version for order listing (lighter payload)
 */
export interface OrderSummaryResponse {
  id: UUID;
  orderNumber: string;
  status: OrderStatus;
  totalAmountCents: number;
  createdAt: Date;
  vendorCount: number; // Quick preview: how many vendors in this order
  itemCount: number;   // Total items across all vendors
}

/**
 * Vendor order with nested items for detailed view
 */
export interface VendorOrderWithItemsResponse {
  id: UUID;
  status: VendorOrderStatus;
  subtotalAmountCents: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Vendor info
  vendor: Pick<Organization, 'id' | 'name' | 'slug'>;
  
  // Items in this vendor's sub-order
  items: OrderItemWithVariantResponse[];
}

/**
 * Order item with variant details for display
 */
export interface OrderItemWithVariantResponse {
  id: UUID;
  quantity: number;
  priceSnapshotCents: number;
  skuSnapshot: string;
  productNameSnapshot: string;
  
  // Minimal variant info (snapshot + current ID)
  variant: {
    id: UUID;
    sku: string;
    name: string | null;
  };
}

/**
 * Refund Response
 */
export interface RefundResponse {
  success: true;
  data: {
    orderId: UUID;
    refundProcessed: boolean;
    restockedItems?: Array<{ variantId: UUID; quantity: number }>;
    message: string;
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 INTERNAL SERVICE TYPES (Not exposed to API)
// ─────────────────────────────────────────────────────────────

/**
 * Internal: What the service layer receives after validation
 * (Derived from CheckoutRequest + authenticated user)
 */
export interface CreateOrderCommand {
  customerUserId: UUID;
  clientRequestId: string;
  paymentMethod: 'fake';
  shippingAddress: CheckoutRequest['shipping_address'];
  notes?: string;
}

/**
 * Internal: Cart item enriched with data needed for order creation
 * (Fetched from DB with FOR UPDATE lock)
 */
export interface LockedCartItem {
  cartItemId: UUID;
  variantId: UUID;
  quantity: number;
  priceCents: number;
  sku: string;
  productName: string;
  organizationId: UUID; // vendor
  vendorName: string;
  currentStock: number; // for validation
}

/**
 * Internal: Grouped items by vendor for splitting orders
 */
export interface VendorOrderGroup {
  vendorOrganizationId: UUID;
  vendorName: string;
  items: LockedCartItem[];
  subtotalCents: number;
}

/**
 * Internal: Result of successful order creation transaction
 */
export interface OrderCreationResult {
  orderId: UUID;
  orderNumber: string;
  vendorOrderIds: Record<UUID, UUID>; // vendorId → vendorOrderId mapping
  totalAmountCents: number;
}

// ─────────────────────────────────────────────────────────────
// 🔹 Filter Types (unchanged - perfect for listing endpoints)
// ─────────────────────────────────────────────────────────────
export interface OrderFilters {
  customerUserId?: UUID;
  status?: OrderStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface VendorOrderFilters {
  vendorOrganizationId?: UUID;
  status?: VendorOrderStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}