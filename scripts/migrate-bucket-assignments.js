#!/usr/bin/env node

/**
 * Targeted migration: ensure bucket_assignments table and its indexes exist.
 *
 * Safe to run on an existing database — uses CREATE TABLE IF NOT EXISTS
 * and CREATE INDEX IF NOT EXISTS so no existing data is modified.
 *
 * Usage:
 *   node scripts/migrate-bucket-assignments.js
 *   # or
 *   npm run db:migrate:assignments
 */

const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌  DATABASE_URL is not set.');
    console.error('    Copy .env.example to .env and fill in your database details.');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔌  Connecting to PostgreSQL…');
    await client.connect();
    console.log('✅  Connected');

    // --- 1. Create bucket_assignments table --------------------------------
    console.log('\n📦  Creating bucket_assignments table (if not exists)…');
    await client.query(`
      CREATE TABLE IF NOT EXISTS bucket_assignments (
        id           SERIAL      PRIMARY KEY,
        bucket_id    INTEGER     NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
        user_id      INTEGER     NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        permission   VARCHAR(20) NOT NULL DEFAULT 'read',
        assigned_by  INTEGER     REFERENCES users(id),
        created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bucket_id, user_id)
      )
    `);
    console.log('   ✅  bucket_assignments table ready');

    // --- 2. Create indexes --------------------------------------------------
    console.log('\n🔍  Creating indexes (if not exists)…');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bucket_assignments_bucket_id
      ON bucket_assignments(bucket_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bucket_assignments_user_id
      ON bucket_assignments(user_id)
    `);
    console.log('   ✅  Indexes ready');

    // --- 3. Verify ----------------------------------------------------------
    const check = await client.query(`
      SELECT COUNT(*) AS rows FROM bucket_assignments
    `);
    console.log(`\n📊  bucket_assignments rows: ${check.rows[0].rows}`);

    console.log('\n🎉  Migration completed successfully!\n');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    if (err.code === '42P01') {
      console.error(
        '    Hint: the "buckets" or "users" table is missing. ' +
        'Run `npm run db:migrate` first to apply the full schema.'
      );
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
