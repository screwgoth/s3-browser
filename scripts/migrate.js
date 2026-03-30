#!/usr/bin/env node

/**
 * Database Migration Script
 * Runs schema.sql to create all tables and indexes
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    console.log('📄 Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔧 Running migrations...');
    await client.query(schemaSql);
    console.log('✅ Schema created successfully');

    console.log('\n📊 Database tables:');
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    result.rows.forEach((row) => {
      console.log(`  • ${row.tablename}`);
    });

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('📝 Copy .env.example to .env and configure your database connection');
  process.exit(1);
}

migrate();
