// src/middlewares/authorize.middleware.ts
// ✅ ميدل وير مرن للتحقق من الصلاحيات والسياسات

import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { Permission, UserRole } from "../constants/permissions";
import { AuthorizationService } from "../services/authorization.service";
import { ForbiddenError } from "../errors/AppError";

// دالة مساعدة للتحقق من أن القيمة من نوع Permission
function isValidPermission(value: string): value is Permission {
  return Object.values(Permission).includes(value as Permission);
}

/**
 * 🎯 الميدل وير الرئيسي للتحقق من الصلاحيات
 * 
 * @param permission الصلاحية المطلوبة (أو مصفوفة منها)
 * @param options خيارات إضافية:
 *   - requireAll: إذا كانت مصفوفة، هل يجب أن يملك كلها أم واحدة تكفي؟
 *   - condition: دالة شرطية ديناميكية (مثلاً: التحقق من ملكية المورد)
 * 
 * @example
 * router.patch("/products/:id", authorize(Permission.PRODUCT_UPDATE));
 * 
 * @example مع شرط ديناميكي
 * router.patch("/products/:id", 
 *   authorize(Permission.PRODUCT_UPDATE, {
 *     condition: async (req) => {
 *       const product = await Product.findById(req.params.id);
 *       AuthorizationService.assertOwnership(req.user!.organization_id, product);
 *       return true;
 *     }
 *   })
 * );
 */
export const authorize = (
  permission: Permission | Permission[],
  options?: {
    requireAll?: boolean;
    condition?: (req: AuthRequest) => Promise<boolean> | boolean;
  }
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    
    // 1. تحقق أساسي: هل المستخدم موجود؟
    if (!user?.role) {
      throw new ForbiddenError("Authentication required");
    }

    // 2. تحويل الصلاحية لمصفوفة لتسهيل المعالجة
    const permissions = Array.isArray(permission) ? permission : [permission];
    
    // 3. تحقق من نوع الصلاحيات (لأمان إضافي)
    const validPermissions = permissions.filter(isValidPermission);
    if (validPermissions.length === 0) {
      console.error("Invalid permission provided:", permissions);
      throw new ForbiddenError("Configuration error: invalid permission");
    }

    // 4. التحقق من أن الدور يملك الصلاحية المطلوبة
    const hasAccess = AuthorizationService.hasPermissions(
      user.role as UserRole,
      validPermissions,
      options?.requireAll ?? false
    );

    if (!hasAccess) {
      throw new ForbiddenError("You do not have permission to access this resource");
    }

    // 5. ✅ التحقق من الشرط الديناميكي (إذا وُجد)
    //    هذا هو المكان الذي نتحقق فيه من ملكية المورد، الحالة، إلخ.
    if (options?.condition) {
      try {
        const conditionMet = await options.condition(req);
        if (!conditionMet) {
          throw new ForbiddenError("Access denied by policy");
        }
      } catch (error) {
        // إذا كان الخطأ بالفعل ForbiddenError، نرميه كما هو
        // إذا كان خطأ آخر (مثل قاعدة بيانات)، نعالجه بأمان
        if (error instanceof ForbiddenError) {
          throw error;
        }
        console.error("Authorization condition error:", error);
        throw new ForbiddenError("Access denied");
      }
    }

    // 6. ✅ كل شيء جيد، نكمل
    return next();
  };
};