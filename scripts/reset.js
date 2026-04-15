#!/usr/bin/env node

/**
 * Database Reset Script
 * ⚠️ WARNING: Drops all tables and recreates them
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config();

async function reset() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('⚠️  WARNING: This will delete ALL data!');
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    console.log('🗑️  Dropping all tables...');
    await client.query(`
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS app_settings CASCADE;
      DROP TABLE IF EXISTS bucket_assignments CASCADE;
      DROP TABLE IF EXISTS buckets CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    `);
    console.log('✅ Tables dropped');

    await client.end();

    console.log('🔧 Running migrations...');
    execSync('node scripts/migrate.js', { stdio: 'inherit' });

    console.log('🌱 Running seed...');
    execSync('node scripts/seed.js', { stdio: 'inherit' });

    console.log('\n🎉 Database reset completed successfully!');
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('📝 Copy .env.example to .env and configure your database connection');
  process.exit(1);
}

reset();
