// scripts/seed-platform-admin.ts
// Creates the initial Platform Admin user (run once per environment)

import "dotenv/config";
import pool from "../src/db/database";
import { createUser } from "../src/repository/users.repo";
import { UserRole } from "../src/constants/permissions";
import bcrypt from "bcrypt";

// =============================================================================
// CONFIG: Read from environment variables (never hardcode!)
// =============================================================================

// =============================================================================
// MAIN: Create Platform Admin
// =============================================================================

async function seedPlatformAdmin() {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || "admin@platform.com";
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("❌ Error: PLATFORM_ADMIN_PASSWORD environment variable is required");
    console.log("💡 Set it in your .env file:");
    console.log(`   PLATFORM_ADMIN_PASSWORD=YourSecurePassword123!`);
    process.exit(1);
  }

  console.log("🔐 Seeding Platform Admin...");

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    console.log("✅ Password hashed");

    // ✅ 2. Create user with PLATFORM_ADMIN role
    const user = await createUser({
      email: adminEmail.toLowerCase().trim(),
      passwordHash,
      role: UserRole.PLATFORM_ADMIN,
      organizationId: null, // Platform admins are not tied to a vendor org
    });

    console.log("✅ Platform Admin created successfully:");
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   🔑 Role: ${user.role}`);
    console.log(`   🆔 ID: ${user.id}`);
    console.log("\n🔐 Next steps:");
    console.log("   1. Use this email to login at /auth/login");
    console.log("   2. Access platform admin routes at /console/*");
    console.log("   3. Change the password after first login (recommended)");

  } catch (error) {
    console.error("❌ Failed to seed Platform Admin:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// =============================================================================
// RUN
// =============================================================================

seedPlatformAdmin();