# Database Implementation TODO

This document tracks remaining tasks to fully migrate from localStorage to PostgreSQL.

## ✅ Completed

- [x] Database schema design
- [x] Docker Compose setup for PostgreSQL + pgAdmin
- [x] Migration scripts (schema.sql)
- [x] Seed script (default admin user)
- [x] Database connection pool (`src/lib/db.ts`)
- [x] Management script (`db.sh`)
- [x] Documentation (DATABASE.md, MIGRATION_GUIDE.md)
- [x] Updated package.json with dependencies

## 🔄 In Progress

### Core Database Operations

- [ ] **User Management**
  - [ ] Replace localStorage auth in `src/context/AuthContext.tsx`
  - [ ] Create `src/lib/users.ts` with user CRUD operations
  - [ ] Implement password hashing with bcrypt
  - [ ] Create user login API endpoint
  - [ ] Create user registration API endpoint
  - [ ] Update `src/app/users/page.tsx` to use database

- [ ] **Bucket Management**
  - [ ] Replace localStorage in `src/context/BucketContext.tsx`
  - [ ] Create `src/lib/buckets.ts` with bucket CRUD operations
  - [ ] Encrypt AWS credentials before storing (use crypto module)
  - [ ] Update bucket actions to use database
  - [ ] Migrate `src/app/bucket-assignments/page.tsx` to database

- [ ] **Session Management**
  - [ ] Implement session tokens (replace localStorage sessions)
  - [ ] Create middleware for authentication checks
  - [ ] Add session cleanup (expire old sessions)

- [ ] **Audit Logging**
  - [ ] Hook audit logging into all operations
  - [ ] Update `src/app/admin/audit/page.tsx` to read from database
  - [ ] Add audit log search/filtering

### Security

- [ ] **Credential Encryption**
  - [ ] Implement AES-256 encryption for AWS credentials
  - [ ] Store encryption key in environment variable
  - [ ] Encrypt/decrypt transparently in bucket operations

- [ ] **Password Security**
  - [ ] Ensure bcrypt is used for all password operations
  - [ ] Add password strength requirements
  - [ ] Implement password reset functionality

- [ ] **Session Security**
  - [ ] Add CSRF protection
  - [ ] Implement session timeout (configurable)
  - [ ] Add "Remember Me" functionality (optional)

### Data Migration

- [ ] **localStorage → PostgreSQL Migration Script**
  - [ ] Create `scripts/migrate-from-localstorage.js`
  - [ ] Extract users from localStorage
  - [ ] Extract buckets from localStorage
  - [ ] Import into PostgreSQL
  - [ ] Provide migration UI or CLI command

### API Endpoints

Create new API routes for database operations:

- [ ] `src/app/api/auth/login/route.ts`
- [ ] `src/app/api/auth/logout/route.ts`
- [ ] `src/app/api/auth/session/route.ts`
- [ ] `src/app/api/users/route.ts` (list, create)
- [ ] `src/app/api/users/[id]/route.ts` (get, update, delete)
- [ ] `src/app/api/buckets/route.ts` (list, create)
- [ ] `src/app/api/buckets/[id]/route.ts` (get, update, delete)
- [ ] `src/app/api/audit/route.ts` (list logs)
- [ ] `src/app/api/settings/route.ts` (get/set app settings)

### Database Utilities

- [ ] **Query Builders**
  - [ ] Create helper functions for common queries
  - [ ] Add pagination utilities
  - [ ] Add search/filter utilities

- [ ] **Database Models**
  - [ ] Create TypeScript interfaces for all tables
  - [ ] Add validation schemas (Zod)

### Testing

- [ ] **Unit Tests**
  - [ ] Test database connection
  - [ ] Test user CRUD operations
  - [ ] Test bucket CRUD operations
  - [ ] Test encryption/decryption
  - [ ] Test audit logging

- [ ] **Integration Tests**
  - [ ] Test full user registration flow
  - [ ] Test bucket creation and browsing
  - [ ] Test permission system

### UI Updates

- [ ] **Update Context Providers**
  - [ ] `AuthContext.tsx` - use database
  - [ ] `BucketContext.tsx` - use database
  - [ ] `UserContext.tsx` - use database

- [ ] **Update Pages**
  - [ ] Login page - use database authentication
  - [ ] Users page - fetch from database
  - [ ] Bucket assignments - use database
  - [ ] Profile page - update user in database
  - [ ] Admin audit page - fetch from database

### Performance

- [ ] **Caching**
  - [ ] Add Redis for session storage (optional)
  - [ ] Cache frequently accessed data
  - [ ] Implement query result caching

- [ ] **Optimization**
  - [ ] Add database indexes for common queries
  - [ ] Optimize N+1 query problems
  - [ ] Add query performance monitoring

### Documentation

- [ ] **API Documentation**
  - [ ] Document all API endpoints
  - [ ] Add request/response examples
  - [ ] Document error codes

- [ ] **Code Documentation**
  - [ ] Add JSDoc comments to database functions
  - [ ] Document database schema relationships
  - [ ] Add inline code comments

### DevOps

- [ ] **Docker Integration**
  - [ ] Update main `docker-compose.yml` to include database
  - [ ] Create unified `docker.sh` script
  - [ ] Add health checks

- [ ] **Production Deployment**
  - [ ] Create production database setup guide
  - [ ] Add SSL/TLS configuration
  - [ ] Document backup/restore procedures
  - [ ] Add monitoring setup

### Nice to Have

- [ ] **Advanced Features**
  - [ ] Multi-factor authentication (2FA)
  - [ ] OAuth integration (Google, GitHub)
  - [ ] Email notifications (password reset, etc.)
  - [ ] Activity dashboard
  - [ ] Usage statistics
  - [ ] File upload/download tracking

- [ ] **Admin Tools**
  - [ ] Database backup UI
  - [ ] User management improvements
  - [ ] Bulk operations
  - [ ] Export audit logs to CSV/JSON

## Priority Order

### Phase 1: Core Functionality (Week 1)
1. User authentication (login/logout)
2. User CRUD operations
3. Bucket CRUD operations
4. Basic session management

### Phase 2: Security (Week 2)
5. Credential encryption
6. Session security
7. Audit logging integration
8. CSRF protection

### Phase 3: Migration & Polish (Week 3)
9. localStorage migration script
10. UI updates
11. Testing
12. Documentation

### Phase 4: Production Ready (Week 4)
13. Performance optimization
14. Production deployment guide
15. Monitoring setup
16. Backup automation

## Files to Modify

### High Priority
- `src/context/AuthContext.tsx`
- `src/context/BucketContext.tsx`
- `src/context/UserContext.tsx`
- `src/app/login/page.tsx`
- `src/app/users/page.tsx`
- `src/app/bucket-assignments/page.tsx`

### Medium Priority
- `src/app/profile/page.tsx`
- `src/app/admin/audit/page.tsx`
- `src/components/s3-browser.tsx`

### New Files Needed
- `src/lib/users.ts`
- `src/lib/buckets.ts`
- `src/lib/auth.ts`
- `src/lib/encryption.ts`
- `src/lib/audit.ts`
- `src/middleware.ts`
- API route files (see above)

## Notes

- Keep localStorage as fallback during migration (graceful degradation)
- Ensure backward compatibility where possible
- Add feature flags for gradual rollout
- Test thoroughly before removing localStorage code

## Questions / Decisions Needed

- [ ] Should we use NextAuth.js or custom authentication?
- [ ] Redis for session storage or PostgreSQL sessions table?
- [ ] Which encryption algorithm for AWS credentials? (AES-256-GCM recommended)
- [ ] Should audit logs be in separate database for compliance?
- [ ] Do we need database migration versioning (like Prisma/TypeORM)?

---

**Last Updated:** 2026-03-30
**Branch:** database-implementation
**Status:** Infrastructure setup complete, implementation in progress
