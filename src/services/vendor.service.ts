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
import {
  findProductsByOrganization,
  countProductsByOrganization,
  findVariantsByProductId,
} from "../repository/products.repo";
import { createAuditLog } from "../repository/audit.repo";
import { Organization } from "../types/organization.types";
import { UserRole } from '../constants/permissions';

const SESSION_LIFETIME_MINUTES = 30;

// 1️⃣ Register new company
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

// 2️⃣ Get company profile
export async function getVendorProfileService(
  organizationId: string,
): Promise<VendorProfileResponse> {
  // Get organization
  const organization = await findOrganizationById(organizationId);
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  // Get admin (first user in organization)
 const admins = await findUsersByOrganization(organizationId, {
  role: UserRole.VENDOR_ADMIN,  
  limit: 1,
});
  if (admins.length === 0) {
    throw new Error("ADMIN_NOT_FOUND");
  }
  const admin = admins[0];

  // Get all staff
  const staff = await findUsersByOrganization(organizationId);

  // Get product statistics
  const totalProducts = await countProductsByOrganization(organizationId, {
    active: true,
  });

  // Get staff statistics
  const totalStaff = await countUsersByOrganization(organizationId);

  // Temporarily for orders (when we add orders later)
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


// 5️⃣ Update company profile
export async function updateVendorProfileService(
  organizationId: string,
  input: UpdateVendorInput,
  userId: string
): Promise<Organization> {
  // Verify organization exists
  const organization = await findOrganizationById(organizationId);
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  // Update organization
  const updatedOrg = await updateOrganization(organizationId, input);
  if (!updatedOrg) {
    throw new Error("UPDATE_FAILED");
  }

  // Log in audit log
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

// 4️⃣ Get vendor products
export async function getVendorProductsService(
  organizationId: string,
  filters: VendorProductFilters,
) {
  const { page = 1, limit = 10, active, search } = filters;
  const offset = (page - 1) * limit;

  // Get products
  const products = await findProductsByOrganization(organizationId, {
    active,
    search,
    limit,
    offset,
  });

  // Get total count
  const total = await countProductsByOrganization(organizationId, {
    active,
    search,
  });

  // Get variants for each product
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