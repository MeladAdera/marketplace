//src/types/order.types.ts
import { User } from './user.types';
import { Organization } from './organization.types';

export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled';
export type VendorOrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'packed' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  customerUserId: string;
  status: OrderStatus;
  totalAmountCents: number;
  clientRequestId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorOrder {
  id: string;
  orderId: string;
  vendorOrganizationId: string;
  status: VendorOrderStatus;
  subtotalAmountCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  vendorOrderId: string;
  variantId: string;
  quantity: number;
  priceSnapshotCents: number;
  skuSnapshot: string;
  productNameSnapshot: string;
  createdAt: Date;
}

export interface CreateOrderInput {
  customerUserId: string;
  clientRequestId: string;
  items: Array<{
    variantId: string;
    quantity: number;
  }>;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmountCents: number;
  createdAt: Date;
  customer: Pick<User, 'id' | 'email'>;
  vendorOrders: VendorOrderResponse[];
}

export interface VendorOrderResponse {
  id: string;
  status: VendorOrderStatus;
  subtotalAmountCents: number;
  createdAt: Date;
  vendor: Pick<Organization, 'id' | 'name' | 'slug'>;
  items: OrderItemResponse[];
}

export interface OrderItemResponse {
  id: string;
  quantity: number;
  priceSnapshotCents: number;
  skuSnapshot: string;
  productNameSnapshot: string;
  variant: {
    id: string;
    sku: string;
    name: string | null;
  };
}

export interface UpdateVendorOrderStatusInput {
  status: VendorOrderStatus;
  reason?: string;
}

export interface OrderFilters {
  customerUserId?: string;
  status?: OrderStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface VendorOrderFilters {
  vendorOrganizationId?: string;
  status?: VendorOrderStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface RefundInput {
  reason: string;
  restockInventory?: boolean;
}