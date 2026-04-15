#!/usr/bin/env node

/**
 * Database Seed Script
 * Creates default admin user and initial settings
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const DEFAULT_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    // Check if admin user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [DEFAULT_USERNAME]
    );

    if (existingUser.rows.length > 0) {
      console.log('ℹ️  Admin user already exists. Skipping seed.');
      return;
    }

    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log('👤 Creating admin user...');
    const result = await client.query(
      `INSERT INTO users (username, password_hash, role, must_change_password) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, role, must_change_password`,
      [DEFAULT_USERNAME, passwordHash, 'admin', true]
    );

    const user = result.rows[0];
    console.log('✅ Admin user created:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Must Change Password: ${user.must_change_password}`);

    console.log('\n📝 Creating default app settings...');
    await client.query(
      `INSERT INTO app_settings (key, value) 
       VALUES 
         ('app_name', $1),
         ('items_per_page', $2),
         ('max_upload_size_mb', $3)
       ON CONFLICT (key) DO NOTHING`,
      [
        JSON.stringify('S3 Navigator'),
        JSON.stringify(25),
        JSON.stringify(100)
      ]
    );
    console.log('✅ Default settings created');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Default credentials:');
    console.log(`   Username: ${DEFAULT_USERNAME}`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log('\n⚠️  Please change these credentials in production!');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
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

seed();
