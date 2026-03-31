#!/usr/bin/env node

/**
 * Generate secure keys for .env file
 */

const crypto = require('crypto');

console.log('🔑 Generating secure keys for S3 Browser\n');

// Generate NEXTAUTH_SECRET
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
console.log('NEXTAUTH_SECRET (for session management):');
console.log(nextAuthSecret);
console.log('');

// Generate ENCRYPTION_KEY
const encryptionKey = crypto.randomBytes(32).toString('base64');
console.log('ENCRYPTION_KEY (for AWS credentials):');
console.log(encryptionKey);
console.log('');

console.log('📝 Add these to your .env file:');
console.log('');
console.log(`NEXTAUTH_SECRET="${nextAuthSecret}"`);
console.log(`ENCRYPTION_KEY="${encryptionKey}"`);
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('  - Keep these keys secret!');
console.log('  - Never commit them to git');
console.log('  - Store them securely (password manager, secrets manager)');
console.log('  - If ENCRYPTION_KEY is lost, encrypted AWS credentials cannot be recovered');
console.log('');
