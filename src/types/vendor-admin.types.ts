import { VendorOrder, VendorOrderStatus, OrderItemWithVariantResponse } from './order.types';

type UUID = string;

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR ORDER SUMMARY TYPES (For listing)
// ─────────────────────────────────────────────────────────────

export interface VendorOrderItemSummary {
  id: UUID;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  priceSnapshotCents: number;
}

export interface VendorOrderSummary {
  id: UUID;
  orderNumber: string;              // From main order
  status: VendorOrderStatus;
  subtotalAmountCents: number;
  itemCount: number;
  customerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  items: VendorOrderItemSummary[];
}

export interface VendorOrderDetailResponse extends VendorOrderSummary {
  shippingAddress?: {
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
}

// ─────────────────────────────────────────────────────────────
// 🔹 FILTER & PAGINATION TYPES
// ─────────────────────────────────────────────────────────────

export interface VendorOrderFilters {
  status?: VendorOrderStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface VendorOrderListResponse {
  success: true;
  data: {
    orders: VendorOrderSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 ORDER STATUS UPDATE TYPES
// ─────────────────────────────────────────────────────────────

export interface UpdateOrderStatusInput {
  newStatus: VendorOrderStatus;
  note?: string;  // Optional internal note for audit
}

export interface UpdateOrderStatusResponse {
  success: true;
  data: {
    orderId: UUID;
    newStatus: VendorOrderStatus;
    message?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR PRODUCT TYPES
// ─────────────────────────────────────────────────────────────

export interface VendorProductSummary {
  id: UUID;
  name: string;
  description: string | null;
  active: boolean;
  variantCount: number;
  totalStock: number;  // Sum of all variants stock
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorProductListResponse {
  success: true;
  data: {
    products: VendorProductSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CreateProductInput {
  name: string;
  description?: string;
  active?: boolean;
  variants: CreateVariantInput[];
}

export interface CreateVariantInput {
  sku: string;
  name?: string;  // e.g., "Red / Large"
  priceCents: number;
  stockQuantity: number;
  active?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  active?: boolean;
}

export interface UpdateVariantInput {
  sku?: string;
  name?: string;
  priceCents?: number;
  stockQuantity?: number;
  active?: boolean;
}

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR INVENTORY TYPES
// ─────────────────────────────────────────────────────────────

export interface InventoryItemSummary {
  variantId: UUID;
  productId: UUID;
  productName: string;
  variantName: string | null;
  sku: string;
  currentStock: number;
  priceCents: number;
  lastUpdated: Date;
}

export interface InventoryListResponse {
  success: true;
  data: {
    items: InventoryItemSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface UpdateInventoryInput {
  stockQuantity: number;  // Absolute value, not delta
  note?: string;
}

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR STATISTICS TYPES (ENHANCED)
// ─────────────────────────────────────────────────────────────

/**
 * Filters for statistics endpoint (query params)
 */
export interface VendorStatisticsFilters {
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Detailed breakdown of orders by status
 */
export interface OrderStatusBreakdown {
  pending: number;
  accepted: number;
  packed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  refunded: number;
}

/**
 * Top product stat with optional variant details
 */
export interface TopProductStat {
  productId: UUID;
  productName: string;
  variantId?: UUID;              // Optional: if tracking per-variant stats
  variantName?: string | null;   // e.g., "Red / L"
  unitsSold: number;
  revenueCents: number;
}

/**
 * Enhanced VendorStatisticsResponse with comprehensive metrics
 */
export interface VendorStatisticsResponse {
  success: true;
  data: {
    // 📈 Key Metrics
    totalOrders: number;
    totalRevenueCents: number;
    averageOrderValueCents: number;
    
    // 📊 Status Breakdown
    ordersByStatus: OrderStatusBreakdown;
    
    // 🎯 Recent Activity
    recentOrdersCount: number;        // Orders in last 7 days
    revenueGrowthPercent?: number;    // % change vs previous period (optional)
    
    // 🏆 Top Products
    topProducts: TopProductStat[];
    
    // 📦 Inventory Summary
    lowStockItemsCount: number;       // Items with stock < 10
    totalVariantsCount: number;       // Total active variants
    
    // 🗓️ Period Info
    period: {
      type: string;                   // 'week', 'month', etc.
      from: Date;
      to: Date;
    };
    
    // ⏰ Metadata
    generatedAt: Date;                // When stats were calculated
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR USER MANAGEMENT TYPES (ENHANCED)
// ─────────────────────────────────────────────────────────────

/**
 * Filters for listing vendor users (query params)
 */
export interface VendorUserFilters {
  role?: 'vendor_admin' | 'vendor_staff';
  isActive?: boolean;
  search?: string;                    // Search by email
  page?: number;
  limit?: number;
}

/**
 * Enhanced VendorUserSummary with audit fields
 */
export interface VendorUserSummary {
  id: UUID;
  email: string;
  role: 'vendor_admin' | 'vendor_staff';
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date | null;          // Nullable: user may never have logged in
  
  // Who invited this user? (useful for audit)
  invitedBy?: {
    id: UUID;
    email: string;
  } | null;
}

export interface VendorUserListResponse {
  success: true;
  data: {
    users: VendorUserSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Enhanced InviteVendorUserInput with email option
 */
export interface InviteVendorUserInput {
  email: string;
  role: 'vendor_admin' | 'vendor_staff';
  sendEmail?: boolean;                // Default: true - whether to send invitation email
}

/**
 * Response for successful invitation
 */
export interface InviteVendorUserResponse {
  success: true;
  data: {
    invitationId: UUID;
    email: string;
    role: string;
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: Date;                  // When the invitation link expires
    message: string;                  // "Invitation sent to email@example.com"
  };
}

/**
 * Input for accepting an invitation
 */
export interface AcceptInvitationInput {
  invitationToken: string;
  password: string;
}

// ─────────────────────────────────────────────────────────────
// 🔹 HELPER TYPES (Reusable across endpoints)
// ─────────────────────────────────────────────────────────────

/**
 * Standard pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard success response wrapper (for consistency)
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Date range utility (used in statistics, reports, etc.)
 */
export interface DateRange {
  from: Date;
  to: Date;
}