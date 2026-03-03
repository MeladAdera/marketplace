import { VendorOrder, VendorOrderStatus, OrderItemWithVariantResponse } from './order.types';
import { Organization } from './organization.types';

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
  // Can extend with more details later if needed
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
// 🔹 VENDOR PRODUCT TYPES (For future endpoints)
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
// 🔹 VENDOR STATISTICS TYPES
// ─────────────────────────────────────────────────────────────

export interface VendorStatisticsResponse {
  success: true;
  data: {
    totalOrders: number;
    totalRevenueCents: number;
    averageOrderValueCents: number;
    pendingOrders: number;
    topProducts: Array<{
      productId: UUID;
      productName: string;
      unitsSold: number;
      revenueCents: number;
    }>;
    period: {
      from: Date;
      to: Date;
    };
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR USER MANAGEMENT TYPES
// ─────────────────────────────────────────────────────────────

export interface VendorUserSummary {
  id: UUID;
  email: string;
  role: 'vendor_admin' | 'vendor_staff';
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
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

export interface InviteVendorUserInput {
  email: string;
  role: 'vendor_admin' | 'vendor_staff';
}

export interface AcceptInvitationInput {
  invitationToken: string;
  password: string;
}