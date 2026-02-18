// src/services/vendor.service.ts
import bcrypt from "bcrypt";
import pool from "../db/database"; // للـ transaction
import { createOrganization, findOrganizationBySlug } from "../repository/organization.repo";
import { createUser, findUserByEmail } from "../repository/users.repo";
import { createSession } from "../repository/sessions.repo";
import { generateSessionToken, hashSessionToken } from "../utils/crypto";
import { 
  RegisterVendorInput, 
  RegisterVendorResponse,
  VendorProfileResponse 
} from "../types/vendor.types";
import { UserRole } from "../types/user.types";

const SESSION_LIFETIME_MINUTES = 30;

export async function registerVendorService(
  input: RegisterVendorInput
): Promise<RegisterVendorResponse> {
  const { companyName, companySlug, adminEmail, adminPassword } = input;
  
  // 1️⃣ التحقق من الإيميل (باستخدام repository موجود)
  const existingUser = await findUserByEmail(adminEmail);
  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // 2️⃣ التحقق من slug (باستخدام repository جديد)
  const existingOrg = await findOrganizationBySlug(companySlug);
  if (existingOrg) {
    throw new Error("SLUG_ALREADY_EXISTS");
  }

  // 3️⃣ نبدأ Transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 3.1 إنشاء المنظمة
    const organization = await createOrganization({
      name: companyName,
      slug: companySlug,
      status: 'active'
    });

    // 3.2 تشفير كلمة المرور
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // 3.3 إنشاء المستخدم (Vendor Admin)
    const user = await createUser({
      email: adminEmail,
      passwordHash,
      role: 'vendor_admin' as UserRole,
      organizationId: organization.id
    });

    // 3.4 إنشاء جلسة
    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);

    const expiresAt = new Date(
      Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000
    );

    const session = await createSession({
      userId: user.id,
      sessionTokenHash,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      expiresAt,
    });

    await client.query('COMMIT');

  return {
  user: {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
    createdAt: user.createdAt
  },
  organization: {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    created_at: organization.created_at,
    updated_at: organization.updated_at
  },
  session: {
    id: session.id,
    expiresAt: session.expiresAt
  },
  sessionToken: sessionToken 
};

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getVendorProfileService(
  organizationId: string
): Promise<VendorProfileResponse> {
  // هنا هنجيب ملف الشركة مع إحصائياتها
  // سنكملها بعد ما نضيف دوال إضافية
  
  throw new Error("NOT_IMPLEMENTED");
}

export async function updateVendorProfileService(
  organizationId: string,
  input: any
): Promise<any> {
  // هنا هحدث بيانات الشركة
  // سنكملها لاحقاً
  
  throw new Error("NOT_IMPLEMENTED");
}