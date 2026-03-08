// src/services/authorization.service.ts
// ✅ خدمة مركزية للتحقق من الصلاحيات والسياسات

import { UserRole, Permission, ROLE_PERMISSIONS, hasPermission } from '../constants/permissions';
import { ForbiddenError } from '../errors/AppError';

export class AuthorizationService {
  
  /**
   * ✅ التحقق من أن الدور يملك صلاحية معينة
   * @param role دور المستخدم
   * @param permission الصلاحية المطلوبة
   * @returns true إذا كان يملك الصلاحية
   */
  static hasPermission(role: UserRole, permission: Permission): boolean {
    return hasPermission(role, permission);
  }

  /**
   * ✅ التحقق من عدة صلاحيات (كلها أو أي واحدة)
   * @param role دور المستخدم
   * @param permissions قائمة الصلاحيات
   * @param requireAll إذا true: يجب أن يملك كلها، إذا false: يكفي واحدة
   */
  static hasPermissions(
    role: UserRole,
    permissions: Permission[],
    requireAll: boolean = false
  ): boolean {
    if (requireAll) {
      return permissions.every(p => hasPermission(role, p));
    }
    return permissions.some(p => hasPermission(role, p));
  }

  /**
   * 🎯 التحقق من ملكية المورد (أهم جزء للأمان!)
   * يتحقق أن المورد ينتمي لنفس منظمة المستخدم
   * 
   * @param userOrganizationId منظمة المستخدم
   * @param resource أي كائن يحتوي على organization_id
   * @throws ForbiddenError إذا لم يكن المستخدم يملك المورد
   */
  static assertOwnership<T extends { organization_id: string | null }>(
    userOrganizationId: string,
    resource: T
  ): void {
    if (resource.organization_id !== userOrganizationId) {
      throw new ForbiddenError("You can only access resources within your organization");
    }
  }

  /**
   * 🎯 رفع خطأ ممنوع بشكل آمن (دالة مساعدة)
   */
  static deny(message?: string): never {
    throw new ForbiddenError(message ?? "Access denied");
  }
}