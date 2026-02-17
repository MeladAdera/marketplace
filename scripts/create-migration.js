#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('❌ Please provide a migration name');
  console.error('📝 Example: npm run migrate:create add_coupons_table');
  process.exit(1);
}

// Get next number
const migrationsDir = path.join(__dirname, '..', 'src', 'migrations');
const files = fs.readdirSync(migrationsDir);
const nextNumber = String(files.length + 1).padStart(3, '0');

const filename = `${nextNumber}_${migrationName}.sql`;
const filePath = path.join(migrationsDir, filename);

const template = `-- Migration: ${migrationName}
-- Created at: ${new Date().toISOString()}
-- Description: 

BEGIN;

-- Write your migration SQL here


COMMIT;
`;

fs.writeFileSync(filePath, template);
console.log(`✅ Migration created: ${filename}`);
console.log(`📁 Location: ${filePath}`);