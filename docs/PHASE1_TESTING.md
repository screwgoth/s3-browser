# Phase 1 Testing Guide: Authentication with Forced Password Change

This guide will help you test the Phase 1 implementation: user authentication with mandatory password change on first login.

## Prerequisites

1. Database is running:
```bash
./db.sh status
```

2. Database is migrated and seeded:
```bash
npm run db:migrate
npm run db:seed
```

3. Dependencies installed:
```bash
npm install
```

## Test Scenarios

### 1. First Login (Forced Password Change)

**Test Steps:**
1. Start the app: `npm run dev`
2. Navigate to http://localhost:5000/login
3. Login with default credentials:
   - Username: `admin`
   - Password: `admin`

**Expected Result:**
- ✅ Login successful
- ✅ Automatically redirected to `/change-password`
- ✅ Message: "For security reasons, you must change your password before continuing"
- ✅ Cannot access any other page (middleware blocks)

**Change Password:**
1. Enter a new password (must meet requirements):
   - At least 8 characters
   - One uppercase letter
   - One lowercase letter
   - One number
2. Confirm the new password
3. Click "Change Password"

**Expected Result:**
- ✅ Password changed successfully
- ✅ Redirected to home page `/`
- ✅ Can now access all pages
- ✅ Audit log created

### 2. Subsequent Logins (Normal Flow)

**Test Steps:**
1. Logout (if logged in)
2. Login with new credentials:
   - Username: `admin`
   - Password: `<your-new-password>`

**Expected Result:**
- ✅ Login successful
- ✅ Directly redirected to home page `/`
- ✅ No password change required
- ✅ Can access all pages

### 3. Password Change Requirements

**Test Invalid Passwords:**

Try changing password with these invalid inputs:

| Password        | Expected Error                  |
|-----------------|---------------------------------|
| `short`         | At least 8 characters           |
| `lowercase123`  | One uppercase letter            |
| `UPPERCASE123`  | One lowercase letter            |
| `NoNumbers`     | One number                      |
| `Test123` (mismatch) | Passwords do not match   |

**Expected Result:**
- ✅ Each validation error is shown
- ✅ Password is not changed
- ✅ User remains on change password page

### 4. Middleware Protection

**Test Unauthenticated Access:**

Try accessing these URLs without logging in:
- http://localhost:5000/
- http://localhost:5000/users
- http://localhost:5000/profile
- http://localhost:5000/admin

**Expected Result:**
- ✅ All redirect to `/login`
- ✅ Cannot access without authentication

**Test Password Change Requirement:**

1. Login as admin (first login)
2. Try accessing URLs directly:
   - http://localhost:5000/
   - http://localhost:5000/users

**Expected Result:**
- ✅ All redirect to `/change-password`
- ✅ Cannot bypass password change requirement

### 5. Session Management

**Test Session Persistence:**

1. Login successfully
2. Close browser tab
3. Reopen http://localhost:5000

**Expected Result:**
- ✅ Still logged in (session cookie works)
- ✅ Don't need to login again

**Test Logout:**

1. Login successfully
2. Click logout
3. Try accessing http://localhost:5000

**Expected Result:**
- ✅ Logged out successfully
- ✅ Redirected to `/login`
- ✅ Session cookie deleted

### 6. Audit Logging

**Check Audit Logs:**

```bash
# Connect to database
./db.sh psql

# Check audit logs
SELECT username, action, status, created_at 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;

# Exit
\q
```

**Expected Logs:**
- ✅ `login.failed` - for any failed login attempts
- ✅ `login.success` - for successful logins
- ✅ `password.changed` - when password is changed
- ✅ `logout` - when user logs out

### 7. Database Verification

**Check User Table:**

```bash
# Connect to database
./db.sh psql

# View users
SELECT id, username, role, is_active, must_change_password, last_password_change 
FROM users;

# Exit
\q
```

**Expected Data:**
- ✅ Admin user exists
- ✅ `must_change_password` is `true` initially
- ✅ After password change: `must_change_password` is `false`
- ✅ After password change: `last_password_change` has a timestamp

**Check Sessions Table:**

```bash
./db.sh psql

# View active sessions
SELECT user_id, session_token, expires_at, created_at 
FROM sessions 
WHERE expires_at > NOW();

\q
```

**Expected Data:**
- ✅ Session created after login
- ✅ Session deleted after logout
- ✅ Session deleted after password change (old sessions invalidated)

## API Testing (Optional)

### Test with curl

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -c cookies.txt
```

**Check Session:**
```bash
curl http://localhost:5000/api/auth/session \
  -b cookies.txt
```

**Change Password:**
```bash
curl -X POST http://localhost:5000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"oldPassword":"admin","newPassword":"NewPass123"}'
```

**Logout:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt
```

## Known Issues / Limitations

### Current Phase 1 Implementation

✅ **Implemented:**
- User authentication (login/logout)
- Forced password change on first login
- Password strength validation
- Session management
- Middleware protection
- Audit logging
- Database storage

❌ **Not Yet Implemented (Future Phases):**
- Bucket management (still uses localStorage)
- User management UI (still uses localStorage)
- AWS credential encryption
- Profile page database integration
- Multi-user bucket sharing (database)

### What Still Uses localStorage

The following features still use localStorage and will be migrated in future phases:

- Bucket configurations
- User list (on Users page)
- Bucket assignments
- App settings

**Authentication is fully database-powered**, but other features will transition gradually.

## Troubleshooting

### "Database connection failed"

```bash
# Check if PostgreSQL is running
./db.sh status

# If not running, start it
./db.sh start

# Check logs
./db.sh logs
```

### "Invalid session" after login

```bash
# Clear old sessions
./db.sh psql
DELETE FROM sessions;
\q

# Try logging in again
```

### "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port 5432 already in use

Another PostgreSQL instance is running. Either:
1. Stop the other PostgreSQL: `sudo systemctl stop postgresql`
2. Or change port in `docker-compose.db.yml`

## Next Steps

After Phase 1 is validated:

**Phase 2: Bucket Management**
- Migrate bucket CRUD to database
- Encrypt AWS credentials
- Update BucketContext

**Phase 3: User Management**
- Migrate user management UI
- Admin user creation
- Role management

**Phase 4: Full Integration**
- Bucket assignments in database
- Complete audit trail
- Production deployment

## Success Criteria

Phase 1 is complete when:

- [x] Users can login with database credentials
- [x] First login forces password change
- [x] Password requirements are enforced
- [x] Sessions are stored in database
- [x] Middleware protects routes
- [x] Audit logs capture all auth events
- [x] Logout works correctly
- [x] Old sessions are invalidated after password change

---

**Status:** Phase 1 Complete ✅  
**Next:** Phase 2 - Bucket Management Integration
