import fs from 'fs';
import path from 'path';
import pool from '../db/database';

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Enable UUID extension if not exists
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure they run in order

    console.log(`📂 Found ${migrationFiles.length} migration files`);

    // Get executed migrations
    const result = await client.query('SELECT name FROM migrations ORDER BY id');
    const executedMigrations = new Set(result.rows.map(row => row.name));

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedMigrations.has(file)) {
        console.log(`🔄 Running migration: ${file}`);
        
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        try {
          await client.query('BEGIN');
          
          // Execute migration
          await client.query(sql);
          
          // Record migration
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [file]
          );
          
          await client.query('COMMIT');
          console.log(`✅ Migration ${file} completed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`❌ Migration ${file} failed:`, error);
          throw error;
        }
      } else {
        console.log(`⏭️  Skipping ${file} (already executed)`);
      }
    }

    console.log('🎉 All migrations completed successfully');
    
    // Show migration summary
    const summary = await client.query(`
      SELECT name, executed_at 
      FROM migrations 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('\n📊 Last 5 migrations:');
    summary.rows.forEach(row => {
      console.log(`   • ${row.name} (${new Date(row.executed_at).toLocaleString()})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch(console.error);
}

export default runMigrations;