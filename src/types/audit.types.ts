//src/types/audit.types.ts
export interface AuditLog {
  id: string;
  actorUserId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export interface AuditLogResponse {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  actor?: {
    id: string;
    email: string;
    role: string;
  } | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface AuditLogFilters {
  actorUserId?: string;
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}