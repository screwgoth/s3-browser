# Bucket Assignment Feature

## Overview

This feature allows admin users to assign existing buckets to other users with granular permissions (read-only or read-write).

## Changes Made

### 1. New Context: BucketAssignmentContext
**File:** `src/context/BucketAssignmentContext.tsx`

- Manages user-bucket-permission mappings
- Stores assignments in localStorage (`s3-bucket-assignments`)
- Provides methods:
  - `assignUserToBucket(bucketId, username, permission)`
  - `removeUserFromBucket(bucketId, username)`
  - `updateBucketPermission(bucketId, username, permission)`
  - `getBucketAssignments(bucketId)`
  - `getUserAssignments(username)`
  - `getUserBucketPermission(bucketId, username)`

### 2. Enhanced BucketContext
**File:** `src/context/BucketContext.tsx`

**New Features:**
- `BucketWithPermission` type extends `Bucket` with:
  - `permission`: User's permission level (`read-only` | `read-write`)
  - `isOwner`: Boolean indicating if current user owns the bucket
- `allBuckets`: Returns all buckets (admin only)
- Permission checking methods:
  - `canEditBucket(bucketId)`: Only owner can edit
  - `canDeleteBucket(bucketId)`: Only owner can delete
  - `canUploadToBucket(bucketId)`: Owner or users with read-write permission

**Bucket Visibility Logic:**
- Admin users see:
  - All buckets they own
  - Legacy buckets without owner
- Regular users see:
  - Buckets they own
  - Buckets assigned to them

### 3. New Page: Bucket Assignments Management
**File:** `src/app/bucket-assignments/page.tsx`

**Features:**
- Admin-only page (redirects non-admin users)
- Assign users to buckets with permission selection
- View all current assignments grouped by bucket
- Update user permissions on-the-fly
- Remove user assignments
- Visual badges for permission types

**UI Elements:**
- Dropdown selectors for bucket, user, and permission
- Assignment cards showing all users per bucket
- Inline permission editing
- Delete assignment button

### 4. Updated Main Page
**File:** `src/app/page.tsx`

**Changes:**
- Added "Bucket Assignments" button (admin only)
- Permission badges on bucket cards:
  - "R/W" (Read & Write) - green badge
  - "R/O" (Read Only) - gray badge
  - "Owner" badge in table view
- Disabled edit/delete buttons for non-owners
- Shows "Shared by: {owner}" for assigned buckets
- Added permission column in table view

### 5. Updated S3 Browser Component
**File:** `src/components/s3-browser.tsx`

**Changes:**
- Uses `BucketWithPermission` type
- Checks `canUploadToBucket()` permission
- Disables upload button for read-only users
- Shows tooltip explaining why upload is disabled

### 6. Updated Upload Dialog
**File:** `src/components/upload-dialog.tsx`

**Changes:**
- Updated to accept `BucketWithPermission` type

### 7. Updated Layout
**File:** `src/app/layout.tsx`

**Changes:**
- Added `BucketAssignmentProvider` wrapper
- Provider hierarchy: UserProvider → AuthProvider → BucketAssignmentProvider → BucketProvider

## User Experience

### For Admin Users:
1. Create buckets as normal
2. Navigate to "Bucket Assignments" page
3. Select bucket, user, and permission level
4. Click "Assign User"
5. View/edit/remove assignments anytime

### For Regular Users:
1. See only their own buckets + assigned buckets in bucket list
2. Assigned buckets show permission badge (R/O or R/W)
3. Cannot edit or delete buckets they don't own
4. Can upload only if they have read-write permission
5. Can always download/browse regardless of permission

## Permission Matrix

| Action | Owner | Read-Write User | Read-Only User |
|--------|-------|-----------------|----------------|
| Browse | ✅ | ✅ | ✅ |
| Download | ✅ | ✅ | ✅ |
| Upload | ✅ | ✅ | ❌ |
| Edit Config | ✅ | ❌ | ❌ |
| Delete Bucket | ✅ | ❌ | ❌ |
| Test Connection | ✅ | ✅ | ✅ |

## Data Storage

All data is stored in browser localStorage:

- **Buckets:** `s3-buckets` (unchanged)
- **Users:** `s3-users` (unchanged)
- **Assignments:** `s3-bucket-assignments` (new)

**Assignment Format:**
```json
[
  {
    "bucketId": "uuid-here",
    "username": "john",
    "permission": "read-write"
  },
  {
    "bucketId": "uuid-here",
    "username": "jane",
    "permission": "read-only"
  }
]
```

## Future Enhancements

Potential improvements:
- Bulk user assignment
- User groups/roles
- Time-based access (expiring permissions)
- Activity logging (who accessed what)
- Email notifications on assignment
- Export/import assignment configurations

## Testing Checklist

- [ ] Admin can create bucket
- [ ] Admin can assign user with read-only permission
- [ ] Admin can assign user with read-write permission
- [ ] Read-only user cannot upload files
- [ ] Read-write user can upload files
- [ ] Non-owner cannot edit bucket config
- [ ] Non-owner cannot delete bucket
- [ ] Admin can update user permission
- [ ] Admin can remove user assignment
- [ ] User only sees buckets they own or are assigned to
- [ ] Permission badges display correctly
- [ ] Bucket assignments page is admin-only
