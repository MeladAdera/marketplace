// src/services/vendor.service.ts
import bcrypt from "bcrypt";
import pool from "../db/database";
import {
  createOrganization,
  findOrganizationBySlug,
  findOrganizationById,
  updateOrganization,
} from "../repository/organization.repo";
import {
  createUser,
  findUserByEmail,
  findUsersByOrganization,
  countUsersByOrganization,
  findUserByEmailAndOrganization,
} from "../repository/users.repo";
import { createSession } from "../repository/sessions.repo";
import { generateSessionToken, hashSessionToken } from "../utils/crypto";
import {
  RegisterVendorInput,
  RegisterVendorResponse,
  VendorProfileResponse,
  InviteStaffInput,
  InviteStaffResponse,
  VendorProductFilters,
  UpdateVendorInput,
} from "../types/vendor.types";
import { UserRole } from "../types/user.types";
import {
  findProductsByOrganization,
  countProductsByOrganization,
  findVariantsByProductId,
} from "../repository/products.repo";
import { createAuditLog } from "../repository/audit.repo";
import { Organization } from "../types/organization.types";

const SESSION_LIFETIME_MINUTES = 30;

// 1️⃣ تسجيل شركة جديدة
export async function registerVendorService(
  input: RegisterVendorInput,
): Promise<RegisterVendorResponse> {
  const {
    companyName,
    companySlug,
    adminEmail,
    adminPassword,
    ipAddress,
    userAgent,
  } = input;

  const existingUser = await findUserByEmail(adminEmail);
  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const existingOrg = await findOrganizationBySlug(companySlug);
  if (existingOrg) {
    throw new Error("SLUG_ALREADY_EXISTS");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const organization = await createOrganization({
      name: companyName,
      slug: companySlug,
      status: "active",
    });

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const user = await createUser({
      email: adminEmail,
      passwordHash,
      role: "vendor_admin" as UserRole,
      organizationId: organization.id,
    });

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);

    const expiresAt = new Date(
      Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000,
    );

    const session = await createSession({
      userId: user.id,
      sessionTokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
    });

    await createAuditLog({
      actorUserId: user.id,
      organizationId: organization.id,
      action: "VENDOR_REGISTERED",
      entityType: "organization",
      entityId: organization.id,
      metadata: {
        companyName: input.companyName,
        companySlug: input.companySlug,
        adminEmail: input.adminEmail,
      },
    });

    await client.query("COMMIT");

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        isActive: user.is_active,
        createdAt: user.created_at,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        created_at: organization.created_at,
        updated_at: organization.updated_at,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      sessionToken: sessionToken,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// 2️⃣ جلب ملف الشركة
export async function getVendorProfileService(
  organizationId: string,
): Promise<VendorProfileResponse> {
  // جلب المنظمة
  const organization = await findOrganizationById(organizationId);
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  // جلب الأدمن (أول مستخدم في المنظمة)
  const admins = await findUsersByOrganization(organizationId, {
    role: "vendor_admin",
    limit: 1,
  });
  if (admins.length === 0) {
    throw new Error("ADMIN_NOT_FOUND");
  }
  const admin = admins[0];

  // جلب كل الموظفين
  const staff = await findUsersByOrganization(organizationId);

  // جلب إحصائيات المنتجات
  const totalProducts = await countProductsByOrganization(organizationId, {
    active: true,
  });

  // جلب إحصائيات الموظفين
  const totalStaff = await countUsersByOrganization(organizationId);

  // مؤقتاً للطلبات (لما نضيف orders later)
  const totalOrders = 0;
  const totalRevenue = 0;
  const pendingOrders = 0;

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    },
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      organizationId: admin.organization_id,
      isActive: admin.is_active,
      createdAt: admin.created_at,
    },
    staff: staff.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      isActive: user.is_active,
      createdAt: user.created_at,
    })),
    stats: {
      totalProducts,
      totalStaff,
      totalOrders,
      totalRevenue,
      pendingOrders,
    },
  };
}

// 3️⃣ دعوة موظف جديد
export async function inviteStaffService(
  organizationId: string,
  input: InviteStaffInput,
  invitedBy: string,
): Promise<InviteStaffResponse> {
  const { email, role } = input;

  // التحقق من أن الإيميل غير مستخدم في هذه المنظمة
  const existingUser = await findUserByEmailAndOrganization(
    email,
    organizationId,
  );
  if (existingUser) {
    throw new Error("USER_ALREADY_IN_ORGANIZATION");
  }

  // التحقق من أن الإيميل غير مستخدم في منظمة أخرى
  const userElsewhere = await findUserByEmail(email);
  if (userElsewhere) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }

  // إنشاء كلمة مرور مؤقتة
  const tempPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // إنشاء المستخدم الجديد
  const user = await createUser({
    email,
    passwordHash,
    role: role as UserRole,
    organizationId,
  });
  await createAuditLog({
  actorUserId: invitedBy,
  organizationId,
  action: 'STAFF_INVITED',
  entityType: 'user',
  entityId: user.id,
  newValues: {
    email: user.email,
    role: user.role
  }
});

  // TODO: إرسال إيميل الدعوة مع كلمة المرور المؤقتة
  console.log(`Invitation sent to ${email} with password: ${tempPassword}`);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: "pending", // افتراضي، لاحقاً نغير بعد أول تسجيل دخول
    invitedAt: new Date(),
  };
}
 // 5️⃣ تحديث ملف الشركة
export async function updateVendorProfileService(
  organizationId: string,
  input: UpdateVendorInput,
  userId: string
): Promise<Organization> {
  // التحقق من وجود المنظمة
  const organization = await findOrganizationById(organizationId);
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  // تحديث المنظمة
  const updatedOrg = await updateOrganization(organizationId, input);
  if (!updatedOrg) {
    throw new Error("UPDATE_FAILED");
  }

  // تسجيل في audit log
  await createAuditLog({
    actorUserId: userId,
    organizationId,
    action: 'VENDOR_PROFILE_UPDATED',
    entityType: 'organization',
    entityId: organizationId,
    oldValues: {
      name: organization.name,
      slug: organization.slug,
      status: organization.status
    },
    newValues: {
      name: updatedOrg.name,
      slug: updatedOrg.slug,
      status: updatedOrg.status
    }
  });

  return updatedOrg;
}
// 4️⃣ جلب منتجات البائع
export async function getVendorProductsService(
  organizationId: string,
  filters: VendorProductFilters,
) {
  const { page = 1, limit = 10, active, search } = filters;
  const offset = (page - 1) * limit;

  // جلب المنتجات
  const products = await findProductsByOrganization(organizationId, {
    active,
    search,
    limit,
    offset,
  });

  // جلب العدد الكلي
  const total = await countProductsByOrganization(organizationId, {
    active,
    search,
  });

  // جلب الفاريانتات لكل منتج
  const productsWithVariants = await Promise.all(
    products.map(async (product) => {
      const variants = await findVariantsByProductId(product.id);
      return {
        ...product,
        variants,
      };
    }),
  );

  return {
    products: productsWithVariants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrevious: page > 1,
    },
  };
 
}
