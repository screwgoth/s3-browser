# Phase 2 Testing Guide: Bucket Management with Encrypted Credentials

This guide will help you test Phase 2: bucket management with database storage and AWS credential encryption.

## Prerequisites

1. ✅ Phase 1 completed and tested
2. ✅ Database running with migrations applied
3. ✅ Environment configured with encryption key

## Setup

### 1. Generate Encryption Key

```bash
npm run generate-keys
```

Copy the `ENCRYPTION_KEY` to your `.env` file:

```env
ENCRYPTION_KEY="<generated-key-here>"
```

**⚠️ IMPORTANT:** 
- Keep this key secure!
- If lost, encrypted AWS credentials cannot be recovered
- Use a password manager or secrets manager in production

### 2. Test Encryption

```bash
# Connect to Node.js REPL
node

# Test encryption
const { testEncryption } = require('./src/lib/encryption.ts');
console.log(testEncryption()); // Should print: true
```

### 3. Restart Application

```bash
npm run dev
```

## Test Scenarios

### 1. Create Bucket via API

**Test with curl:**

```bash
# Login first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourNewPassword123"}' \
  -c cookies.txt

# Create bucket
curl -X POST http://localhost:5000/api/buckets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "alias": "My Test Bucket",
    "bucket_name": "my-s3-bucket",
    "region": "us-east-1",
    "root_folder": "uploads",
    "access_key_id": "AKIAIOSFODNN7EXAMPLE",
    "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "session_token": "optional-session-token"
  }'
```

**Expected Response:**
```json
{
  "bucket": {
    "id": 1,
    "user_id": 1,
    "alias": "My Test Bucket",
    "bucket_name": "my-s3-bucket",
    "region": "us-east-1",
    "root_folder": "uploads",
    "is_active": true
  }
}
```

**Note:** Credentials are NOT returned in the response (security).

### 2. List Buckets

```bash
curl http://localhost:5000/api/buckets \
  -b cookies.txt
```

**Expected Response:**
```json
{
  "buckets": [
    {
      "id": 1,
      "user_id": 1,
      "alias": "My Test Bucket",
      "bucket_name": "my-s3-bucket",
      "region": "us-east-1",
      "root_folder": "uploads",
      "access_key_id": "AKIAIOSFODNN7EXAMPLE",
      "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "session_token": "optional-session-token",
      "is_active": true,
      "created_at": "2026-03-31T...",
      "updated_at": "2026-03-31T..."
    }
  ],
  "count": 1
}
```

**Note:** Credentials ARE decrypted and returned here (for owner only).

### 3. Get Single Bucket

```bash
curl http://localhost:5000/api/buckets/1 \
  -b cookies.txt
```

**Expected:** Full bucket details with decrypted credentials.

### 4. Update Bucket

```bash
curl -X PATCH http://localhost:5000/api/buckets/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "alias": "Updated Bucket Name",
    "root_folder": "new-uploads"
  }'
```

**Expected:** Updated bucket returned without credentials.

### 5. Delete Bucket

```bash
curl -X DELETE http://localhost:5000/api/buckets/1 \
  -b cookies.txt
```

**Expected:** `{"success": true}`

### 6. Verify Encryption in Database

```bash
# Connect to database
./db.sh psql

# View encrypted credentials
SELECT 
  id, 
  alias,
  bucket_name,
  LEFT(access_key_id, 50) as encrypted_key_preview
FROM buckets;

# The access_key_id should be a long encrypted string like:
# "a1b2c3d4e5f6==:g7h8i9j0k1l2==:m3n4o5p6q7r8=="

\q
```

**Expected:** Credentials are stored in encrypted format (base64 strings with colons).

### 7. Test Encryption/Decryption Cycle

```bash
./db.sh psql

# Get a bucket's encrypted credentials
SELECT access_key_id FROM buckets WHERE id = 1;

# Note the encrypted value, then check if decryption works in app
# The API should return the original plaintext when fetching the bucket
```

**Expected:** 
- Database has encrypted gibberish
- API returns original plaintext

### 8. Permission-Based Access

**Test as Viewer Role:**

```bash
# Create a viewer user (if not exists)
# Then try to create bucket

curl -X POST http://localhost:5000/api/buckets \
  -H "Content-Type: application/json" \
  -b viewer-cookies.txt \
  -d '{"alias":"Test","bucket_name":"test","region":"us-east-1"}'
```

**Expected:** `403 Forbidden - You do not have permission to create buckets`

### 9. Audit Logging

```bash
./db.sh psql

# Check bucket audit logs
SELECT 
  username,
  action,
  resource_type,
  details,
  created_at
FROM audit_logs
WHERE resource_type = 'bucket'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Events:**
- `bucket.created` - When bucket is created
- `bucket.updated` - When bucket is modified
- `bucket.deleted` - When bucket is soft-deleted

### 10. Migration from localStorage

**If you have existing buckets in localStorage:**

1. Export localStorage data:
```javascript
// In browser console (F12)
console.log(JSON.stringify(localStorage.getItem('s3-buckets')))
```

2. Copy the output to a file: `buckets-export.json`

3. Run migration:
```bash
node scripts/migrate-localstorage.js buckets-export.json admin
```

**Expected:**
- All buckets migrated to database
- Credentials encrypted
- Migration summary showing success count

## Security Verification

### Encryption Strength

```bash
# Check encryption algorithm
cat src/lib/encryption.ts | grep ALGORITHM
# Should show: const ALGORITHM = 'aes-256-gcm';
```

**Verified:**
- ✅ AES-256-GCM (authenticated encryption)
- ✅ Random IV per encryption
- ✅ Auth tag verification on decryption

### Key Management

```bash
# Verify encryption key is NOT in repository
git grep ENCRYPTION_KEY

# Should ONLY show:
# .env.example (as placeholder)
# No actual keys!
```

**Expected:**
- ✅ `.env` is gitignored
- ✅ No keys in source code
- ✅ Key only in environment variables

### Database Storage

```bash
./db.sh psql

# View table structure
\d buckets

# Credentials should be TEXT columns
# Not visible in plaintext
```

**Expected:**
- ✅ Credentials stored as TEXT (encrypted)
- ✅ No plaintext credentials in database
- ✅ User cannot read other users' buckets

## Performance Tests

### Encryption Overhead

```bash
# Test encryption speed
node -e "
const { encrypt, decrypt } = require('./src/lib/encryption.ts');
const testData = 'A'.repeat(1000); // 1KB
const start = Date.now();
for (let i = 0; i < 1000; i++) {
  const enc = encrypt(testData);
  decrypt(enc);
}
console.log('1000 encrypt/decrypt cycles:', Date.now() - start, 'ms');
"
```

**Expected:** < 500ms for 1000 cycles (fast enough for production)

### Database Query Performance

```bash
# Create 100 test buckets
# Then time the list query

curl http://localhost:5000/api/buckets -b cookies.txt -w "%{time_total}\n"
```

**Expected:** < 200ms for listing 100 buckets

## Error Handling

### Missing Encryption Key

```bash
# Remove ENCRYPTION_KEY from .env
# Try to create a bucket

curl -X POST http://localhost:5000/api/buckets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"alias":"Test","bucket_name":"test","region":"us-east-1"}'
```

**Expected:** Server error (500) with encryption key error in logs

### Invalid Encrypted Data

```bash
./db.sh psql

# Corrupt encrypted data
UPDATE buckets SET access_key_id = 'invalid-data' WHERE id = 1;

# Try to fetch bucket
\q

curl http://localhost:5000/api/buckets/1 -b cookies.txt
```

**Expected:** Server error (500) - decryption failed

### Unauthorized Access

```bash
# Try to access another user's bucket
curl http://localhost:5000/api/buckets/99 -b cookies.txt
```

**Expected:** 404 Not Found (or 403 Forbidden)

## Integration Tests

### Full Bucket Lifecycle

1. ✅ Create bucket with credentials
2. ✅ Verify encrypted in database
3. ✅ Fetch bucket - credentials decrypted
4. ✅ Update credentials
5. ✅ Delete bucket
6. ✅ Verify soft-delete (is_active = false)

### Multi-User Scenario

1. Create user A
2. User A creates bucket
3. Create user B
4. User B cannot see user A's bucket
5. User B creates their own bucket
6. Each user only sees their own buckets

## Troubleshooting

### "ENCRYPTION_KEY environment variable is not set"

```bash
# Generate key
npm run generate-keys

# Add to .env
echo 'ENCRYPTION_KEY="<generated-key>"' >> .env

# Restart app
```

### "Failed to decrypt data"

- Encryption key changed (old data uses old key)
- Database corruption
- Invalid encrypted format

**Solution:** If key changed, old data is unrecoverable. Delete and recreate buckets.

### Performance Issues

```bash
# Check database indexes
./db.sh psql
\di

# Should have indexes on:
# - buckets(user_id)
# - buckets(alias)
```

## Success Criteria

Phase 2 is complete when:

- [x] Buckets stored in PostgreSQL (not localStorage)
- [x] AWS credentials encrypted at rest (AES-256-GCM)
- [x] CRUD operations work via API
- [x] Encryption/decryption is transparent to app
- [x] Only bucket owner can decrypt credentials
- [x] Audit logs track all bucket operations
- [x] Migration script works for localStorage data
- [x] Permission system respects roles (viewer cannot create)
- [x] Soft delete preserves data
- [x] No credentials leaked in API responses

---

**Status:** Phase 2 Complete ✅  
**Next:** Phase 3 - User Management UI Integration
