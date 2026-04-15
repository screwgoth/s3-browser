# Migration Guide: localStorage → PostgreSQL

This guide helps you migrate your S3 Browser application from localStorage to PostgreSQL.

## Why Migrate?

**localStorage limitations:**
- ❌ Data lost if browser cache is cleared
- ❌ No multi-device sync
- ❌ No backup/restore capabilities
- ❌ Limited to single browser/device
- ❌ No audit trail
- ❌ Credentials stored in plaintext in browser

**PostgreSQL benefits:**
- ✅ Persistent, reliable storage
- ✅ Multi-device access
- ✅ Easy backup/restore
- ✅ Proper authentication
- ✅ Audit logging (PCI-DSS compliant)
- ✅ Better security (encrypted credentials)

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Existing S3 Browser installation (if migrating data)

## Step 1: Backup Your Current Data (Optional)

If you have existing buckets and users in localStorage:

1. Open S3 Browser in your browser
2. Open Developer Console (F12)
3. Go to Application → Local Storage
4. Copy all keys starting with `s3-browser-` to a text file

You'll need this to manually recreate your buckets after migration.

## Step 2: Pull Database Branch

```bash
cd ~/code/s3-browser
git fetch origin
git checkout database-implementation
```

## Step 3: Install Dependencies

```bash
npm install
```

This installs:
- `pg` - PostgreSQL client
- `bcrypt` - Password hashing
- Type definitions

## Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and update if needed:

```env
DATABASE_URL="postgresql://s3admin:s3secure_password_change_me@localhost:5432/s3browser"
NEXTAUTH_SECRET="your-secret-key-here"
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_PASSWORD="admin"
```

**Important:** Generate a secure `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

## Step 5: Start Database

```bash
./db.sh setup
```

This will:
1. Start PostgreSQL and pgAdmin containers
2. Run database migrations (create tables)
3. Seed initial admin user

**Alternative (manual):**

```bash
# Start containers
docker-compose -f docker-compose.db.yml up -d

# Wait a few seconds for PostgreSQL to be ready
sleep 5

# Run migrations
npm run db:migrate

# Seed data
npm run db:seed
```

## Step 6: Verify Database

### Option A: Using pgAdmin (GUI)

1. Open http://localhost:5050
2. Login:
   - Email: `admin@s3browser.local`
   - Password: `admin_change_me`
3. Add server:
   - Name: `S3 Browser DB`
   - Host: `postgres` (Docker network name)
   - Port: `5432`
   - Database: `s3browser`
   - Username: `s3admin`
   - Password: `s3secure_password_change_me`
4. Browse tables under: Servers → S3 Browser DB → Databases → s3browser → Schemas → public → Tables

### Option B: Using psql (CLI)

```bash
./db.sh psql
```

Then run:

```sql
\dt                           -- List all tables
SELECT * FROM users;          -- View users
SELECT * FROM buckets;        -- View buckets
\q                            -- Quit
```

## Step 7: Update Application Code

The database implementation branch includes:

- ✅ Database connection pool (`src/lib/db.ts`)
- 🔄 User authentication (needs update from localStorage)
- 🔄 Bucket management (needs update from localStorage)
- ✅ Audit logging system
- ✅ Session management

**Next steps for full migration:**

1. Replace `localStorage` calls in `src/context/AuthContext.tsx`
2. Replace `localStorage` calls in `src/context/BucketContext.tsx`
3. Update server actions to use database queries
4. Add encryption for AWS credentials in database

## Step 8: Migrate Your Data (Manual)

Since localStorage structure varies, you'll need to manually recreate buckets:

1. Start the app: `npm run dev`
2. Login with: `admin` / `admin`
3. Click "Add S3 Bucket" and recreate your buckets using the data from Step 1

**Planned:** An automated migration script will be added to extract localStorage data and import it into PostgreSQL.

## Step 9: Test Everything

1. ✅ Login works
2. ✅ Create a bucket
3. ✅ Browse bucket
4. ✅ Upload a file
5. ✅ Download a file
6. ✅ Check audit logs (Admin → Audit Trail)
7. ✅ Create another user
8. ✅ Share a bucket

## Database Management Commands

```bash
./db.sh start          # Start database
./db.sh stop           # Stop database
./db.sh restart        # Restart database
./db.sh status         # Check status
./db.sh logs           # View logs
./db.sh psql           # Connect to PostgreSQL
./db.sh backup         # Create backup
./db.sh restore file   # Restore from backup
./db.sh reset          # Reset database (deletes all data!)
```

## Rollback to localStorage

If you need to go back:

```bash
git checkout master
npm install
npm run dev
```

Your localStorage data will still be there (unless you cleared it).

## Security Checklist

Before deploying to production:

- [ ] Change PostgreSQL password in `docker-compose.db.yml`
- [ ] Change pgAdmin password in `docker-compose.db.yml`
- [ ] Generate strong `NEXTAUTH_SECRET` in `.env`
- [ ] Change default admin credentials
- [ ] Enable SSL for PostgreSQL (production)
- [ ] Set up regular automated backups
- [ ] Implement AWS credential encryption at rest
- [ ] Use environment variables (not `.env` file) in production
- [ ] Set up firewall rules (allow only app server to access DB)

## Backup Strategy (Production)

### Automated Daily Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/s3-browser && ./db.sh backup > /backups/$(date +\%Y\%m\%d).log 2>&1
```

### Backup Retention

Keep:
- Daily backups for 7 days
- Weekly backups for 4 weeks
- Monthly backups for 12 months

### Restore Testing

Test restoring from backup monthly to ensure backups are valid.

## Troubleshooting

### Database won't start

```bash
# Check logs
./db.sh logs

# Check if port 5432 is already in use
sudo lsof -i :5432

# If another PostgreSQL is running, stop it or change port in docker-compose.db.yml
```

### Connection errors

```bash
# Check if DATABASE_URL in .env matches docker-compose.db.yml
cat .env
cat docker-compose.db.yml

# Test connection
./db.sh psql
```

### Migration fails

```bash
# Reset and try again
./db.sh reset
```

### App can't connect to database

Make sure:
1. Database is running: `./db.sh status`
2. `.env` file exists with correct `DATABASE_URL`
3. Restart the Next.js app: `npm run dev`

## Support

For issues, open an issue on GitHub or check the documentation:
- [DATABASE.md](DATABASE.md) - Database schema and details
- [README.md](README.md) - General app documentation
