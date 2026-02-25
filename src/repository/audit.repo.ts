import { PoolClient } from "pg";
import pool from "../db/database";
import { AuditLog, CreateAuditLogInput, AuditLogFilters } from "../types/audit.types";

/**
 * إنشاء سجل تدقيق جديد
 */
export async function createAuditLog(
  input: CreateAuditLogInput,
  client?: PoolClient  // ✅ Add optional client parameter
): Promise<AuditLog> {
  const runner = client || pool;  // ✅ Use client if provided, otherwise pool
  
  const query = `
    INSERT INTO audit_logs (
      id,
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      metadata,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      NOW()
    )
    RETURNING
      id,
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      metadata,
      created_at
  `;

  const values = [
    input.actorUserId || null,
    input.organizationId || null,
    input.action,
    input.entityType,
    input.entityId || null,
    input.oldValues ? JSON.stringify(input.oldValues) : null,
    input.newValues ? JSON.stringify(input.newValues) : null,
    input.metadata ? JSON.stringify(input.metadata) : null
  ];

  const result = await runner.query(query, values);  // ✅ Use runner instead of pool
  
  return mapDbAuditToAuditLog(result.rows[0]);
}

/**
 * تحويل من صف قاعدة البيانات إلى كائن AuditLog
 */
function mapDbAuditToAuditLog(dbRow: any): AuditLog {
  return {
    id: dbRow.id,
    actorUserId: dbRow.actor_user_id,
    organizationId: dbRow.organization_id,
    action: dbRow.action,
    entityType: dbRow.entity_type,
    entityId: dbRow.entity_id,
    oldValues: dbRow.old_values ? parseJsonSafely(dbRow.old_values) : null,
    newValues: dbRow.new_values ? parseJsonSafely(dbRow.new_values) : null,
    metadata: dbRow.metadata ? parseJsonSafely(dbRow.metadata) : null,
    createdAt: dbRow.created_at
  };
}

/**
 * دالة مساعدة لتحويل JSON بشكل آمن
 */
function parseJsonSafely(value: any): any {
  if (!value) return null;
  
  // إذا كان object بالفعل، ارجع كما هو
  if (typeof value === 'object') return value;
  
  // إذا كان string، حاول parse
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      // إذا فشل الـ parse، ارجع null أو ارجع الـ string الأصلي
      return null;
    }
  }
  
  return null;
}


/**
 * جلب سجلات التدقيق مع فلترة
 */
export async function findAuditLogs(
  filters: AuditLogFilters = {}
): Promise<{ logs: AuditLog[]; total: number }> {
  const { 
    actorUserId, 
    organizationId, 
    entityType, 
    entityId, 
    action,
    fromDate, 
    toDate,
    page = 1, 
    limit = 50 
  } = filters;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  if (actorUserId) {
    conditions.push(`actor_user_id = $${paramCounter}`);
    params.push(actorUserId);
    paramCounter++;
  }

  if (organizationId) {
    conditions.push(`organization_id = $${paramCounter}`);
    params.push(organizationId);
    paramCounter++;
  }

  if (entityType) {
    conditions.push(`entity_type = $${paramCounter}`);
    params.push(entityType);
    paramCounter++;
  }

  if (entityId) {
    conditions.push(`entity_id = $${paramCounter}`);
    params.push(entityId);
    paramCounter++;
  }

  if (action) {
    conditions.push(`action = $${paramCounter}`);
    params.push(action);
    paramCounter++;
  }

  if (fromDate) {
    conditions.push(`created_at >= $${paramCounter}`);
    params.push(fromDate);
    paramCounter++;
  }

  if (toDate) {
    conditions.push(`created_at <= $${paramCounter}`);
    params.push(toDate);
    paramCounter++;
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';

  // جلب العدد الكلي
  const countQuery = `
    SELECT COUNT(*) as count
    FROM audit_logs
    ${whereClause}
  `;
  
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);

  // جلب السجلات مع pagination
  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const selectQuery = `
    SELECT
      id,
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      metadata,
      created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
  `;

  const result = await pool.query(selectQuery, params);
  
  const logs = result.rows.map(mapDbAuditToAuditLog);

  return { logs, total };
}

/**
 * جلب سجلات التدقيق لكيان معين
 */
export async function findAuditLogsByEntity(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  const query = `
    SELECT
      id,
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      metadata,
      created_at
    FROM audit_logs
    WHERE entity_type = $1 AND entity_id = $2
    ORDER BY created_at DESC
    LIMIT $3
  `;

  const result = await pool.query(query, [entityType, entityId, limit]);
  return result.rows.map(mapDbAuditToAuditLog);
}

/**
 * جلب سجلات التدقيق لمنظمة معينة
 */
export async function findAuditLogsByOrganization(
  organizationId: string,
  limit: number = 50
): Promise<AuditLog[]> {
  const query = `
    SELECT
      id,
      actor_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      metadata,
      created_at
    FROM audit_logs
    WHERE organization_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [organizationId, limit]);
  return result.rows.map(mapDbAuditToAuditLog);
}