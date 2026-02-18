// التعدادات المشتركة
export type UserRole = 
  | 'customer' 
  | 'vendor_admin' 
  | 'vendor_staff' 
  | 'support' 
  | 'platform_admin';

export type OrganizationStatus = 'active' | 'suspended';

export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled';

export type VendorOrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'packed' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

export type InventoryMovementType = 
  | 'reserve' 
  | 'release' 
  | 'restock' 
  | 'manual_adjustment';

// أنواع الصفحات (Pagination)
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// أنواع الأخطاء
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// أنواع الاستجابات
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, any>;
}

// أنواع الطلبات
export interface RequestWithUser extends Express.Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    organizationId?: string | null;
    sessionId: string;
  };
}

// أنواع الفلاتر المشتركة
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface SearchFilter {
  search?: string;
}

// أنواع الإحصائيات
export interface StatsResponse {
  total: number;
  active: number;
  inactive: number;
}

export interface DashboardStats {
  users: StatsResponse;
  organizations: StatsResponse;
  products: StatsResponse & { totalVariants: number };
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    revenueCents: number;
  };
}