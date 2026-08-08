#!/usr/bin/env node

/**
 * Targeted migration: upload controls.
 *   1. Add buckets.max_upload_size (per-bucket max file size in bytes).
 *   2. Create unscanned_objects table + index (fail-open malware scan flags).
 *   3. Create scanned_clean_objects table + index (positive clean-scan records).
 *
 * Safe to run on an existing database — uses ADD COLUMN IF NOT EXISTS,
 * CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
 *
 * Usage:
 *   node scripts/migrate-upload-controls.js
 *   # or
 *   npm run db:migrate:upload-controls
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

    // --- 1. Add buckets.max_upload_size ------------------------------------
    console.log('\n📦  Adding buckets.max_upload_size (if not exists)…');
    await client.query(`
      ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_upload_size BIGINT
    `);
    console.log('   ✅  buckets.max_upload_size ready');

    // --- 2. Create unscanned_objects table ---------------------------------
    console.log('\n📦  Creating unscanned_objects table (if not exists)…');
    await client.query(`
      CREATE TABLE IF NOT EXISTS unscanned_objects (
        id          SERIAL    PRIMARY KEY,
        bucket_id   INTEGER   NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
        object_key  TEXT      NOT NULL,
        reason      TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bucket_id, object_key)
      )
    `);
    console.log('   ✅  unscanned_objects table ready');

    // --- 3. Create index ----------------------------------------------------
    console.log('\n🔍  Creating index (if not exists)…');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_unscanned_objects_lookup
      ON unscanned_objects(bucket_id, object_key)
    `);
    console.log('   ✅  Index ready');

    // --- 4. Create scanned_clean_objects table + index ---------------------
    console.log('\n📦  Creating scanned_clean_objects table (if not exists)…');
    await client.query(`
      CREATE TABLE IF NOT EXISTS scanned_clean_objects (
        id          SERIAL    PRIMARY KEY,
        bucket_id   INTEGER   NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
        object_key  TEXT      NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bucket_id, object_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scanned_clean_objects_lookup
      ON scanned_clean_objects(bucket_id, object_key)
    `);
    console.log('   ✅  scanned_clean_objects table ready');

    console.log('\n🎉  Migration completed successfully!\n');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    if (err.code === '42P01') {
      console.error(
        '    Hint: the "buckets" table is missing. ' +
        'Run `npm run db:migrate` first to apply the full schema.'
      );
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
