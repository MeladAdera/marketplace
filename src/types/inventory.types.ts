import { InventoryMovementType } from './common.types';

export interface InventoryMovement {
  id: string;
  organizationId: string;
  variantId: string;
  actorUserId: string | null;
  type: InventoryMovementType;
  quantityChange: number;
  reason: string | null;
  relatedVendorOrderId: string | null;
  createdAt: Date;
}

export interface CreateInventoryMovementInput {
  organizationId: string;
  variantId: string;
  actorUserId?: string | null;
  type: InventoryMovementType;
  quantityChange: number;
  reason?: string | null;
  relatedVendorOrderId?: string | null;
}

export interface InventoryMovementResponse {
  id: string;
  type: InventoryMovementType;
  quantityChange: number;
  reason: string | null;
  createdAt: Date;
  variant: {
    id: string;
    sku: string;
    name: string | null;
    product: {
      id: string;
      name: string;
    };
  };
  actor?: {
    id: string;
    email: string;
    role: string;
  } | null;
}

export interface StockUpdateInput {
  variantId: string;
  quantity: number; // الكمية الجديدة
  reason?: string;
}

export interface BulkStockUpdateInput {
  updates: Array<{
    variantId: string;
    quantity: number;
    reason?: string;
  }>;
}

export interface InventoryCheckInput {
  variantId: string;
  requestedQuantity: number;
}

export interface InventoryCheckResponse {
  variantId: string;
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
}

export interface InventoryFilters {
  organizationId?: string;
  variantId?: string;
  type?: InventoryMovementType;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}