#!/usr/bin/env node

/**
 * Migrate bucket data from localStorage JSON export to PostgreSQL
 * 
 * Usage:
 * 1. Export localStorage data from browser console:
 *    console.log(JSON.stringify(localStorage.getItem('s3-buckets')))
 * 2. Save the output to a file: buckets-export.json
 * 3. Run: node scripts/migrate-localstorage.js buckets-export.json <username>
 */

const { Client } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return Buffer.from(key, 'base64');
}

function encrypt(plaintext) {
  if (!plaintext) return null;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

async function migrate(filePath, username) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected');

    // Get user ID
    console.log(`👤 Looking up user: ${username}`);
    const userResult = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User ${username} not found`);
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ Found user ID: ${userId}`);

    // Read localStorage export
    console.log(`📄 Reading file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse JSON (handle both raw array and stringified format)
    let buckets;
    try {
      const parsed = JSON.parse(fileContent);
      buckets = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch (err) {
      throw new Error('Invalid JSON format. Make sure the file contains valid localStorage data.');
    }

    if (!Array.isArray(buckets)) {
      throw new Error('Expected an array of buckets');
    }

    console.log(`📦 Found ${buckets.length} buckets to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const bucket of buckets) {
      try {
        const alias = bucket.name || bucket.alias;
        const bucketName = bucket.bucket || bucket.bucket_name;
        const region = bucket.region;
        const rootFolder = bucket.folder || bucket.root_folder || null;

        if (!alias || !bucketName || !region) {
          console.warn(`⚠️  Skipping invalid bucket: ${JSON.stringify(bucket)}`);
          skipped++;
          continue;
        }

        // Check if bucket already exists
        const existingResult = await client.query(
          'SELECT id FROM buckets WHERE user_id = $1 AND alias = $2',
          [userId, alias]
        );

        if (existingResult.rows.length > 0) {
          console.log(`⏭️  Skipping existing bucket: ${alias}`);
          skipped++;
          continue;
        }

        // Encrypt credentials
        const accessKeyIdEncrypted = bucket.accessKeyId ? encrypt(bucket.accessKeyId) : null;
        const secretAccessKeyEncrypted = bucket.secretAccessKey ? encrypt(bucket.secretAccessKey) : null;
        const sessionTokenEncrypted = bucket.sessionToken ? encrypt(bucket.sessionToken) : null;

        // Insert bucket
        await client.query(
          `INSERT INTO buckets 
           (user_id, alias, bucket_name, region, root_folder, access_key_id, secret_access_key, session_token)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            alias,
            bucketName,
            region,
            rootFolder,
            accessKeyIdEncrypted,
            secretAccessKeyEncrypted,
            sessionTokenEncrypted,
          ]
        );

        console.log(`✅ Migrated: ${alias} (${bucketName})`);
        migrated++;
      } catch (err) {
        console.error(`❌ Error migrating bucket ${bucket.name || bucket.alias}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Errors:   ${errors}`);
    console.log(`   Total:    ${buckets.length}`);

    if (migrated > 0) {
      console.log('\n🎉 Migration completed successfully!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/migrate-localstorage.js <export-file.json> <username>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/migrate-localstorage.js buckets-export.json admin');
  console.error('');
  console.error('To export localStorage from browser:');
  console.error('  1. Open browser console (F12)');
  console.error('  2. Run: console.log(JSON.stringify(localStorage.getItem("s3-buckets")))');
  console.error('  3. Copy the output to a file');
  process.exit(1);
}

const [filePath, username] = args;

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY environment variable is not set');
  console.error('Run: npm run generate-keys');
  process.exit(1);
}

migrate(filePath, username);
