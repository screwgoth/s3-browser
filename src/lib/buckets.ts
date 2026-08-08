/**
 * Bucket management utilities
 */

import { query, transaction } from './db';
import { encryptCredentials, decryptCredentials, type AWSCredentials } from './encryption';
import { createAuditLog } from './audit';

export interface Bucket {
  id: number;
  user_id: number;
  alias: string;
  bucket_name: string;
  region: string;
  root_folder?: string;
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
  max_upload_size?: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Populated in API responses that carry ownership/assignment context
  owner_username?: string;
  is_owned?: boolean;
  permission?: string | null;
}

export interface BucketAssignmentRecord {
  id: number;
  bucket_id: number;
  user_id: number;
  username: string;
  role?: string;
  permission: string;
  assigned_by?: number;
  created_at: Date;
}

export interface CreateBucketInput {
  alias: string;
  bucket_name: string;
  region: string;
  root_folder?: string;
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
  max_upload_size?: number | null;
  user_id: number;
  username?: string;
}

export interface UpdateBucketInput {
  alias?: string;
  bucket_name?: string;
  region?: string;
  root_folder?: string;
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
  max_upload_size?: number | null;
  is_active?: boolean;
  user_id?: number;
  username?: string;
}

/**
 * Get all buckets across all users (admin only)
 */
export async function getAllBuckets(): Promise<Bucket[]> {
  const result = await query<any>(
    `SELECT
      b.id, b.user_id, b.alias, b.bucket_name, b.region, b.root_folder,
      b.access_key_id  AS access_key_id_encrypted,
      b.secret_access_key AS secret_access_key_encrypted,
      b.session_token  AS session_token_encrypted,
      b.max_upload_size, b.is_active, b.created_at, b.updated_at,
      u.username AS owner_username
     FROM buckets b
     JOIN users u ON b.user_id = u.id
     WHERE b.is_active = true
     ORDER BY b.created_at DESC`
  );

  return result.rows.map((row) => {
    const decrypted = decryptCredentials({
      access_key_id_encrypted: row.access_key_id_encrypted,
      secret_access_key_encrypted: row.secret_access_key_encrypted,
      session_token_encrypted: row.session_token_encrypted,
    });

    return {
      id: row.id,
      user_id: row.user_id,
      alias: row.alias,
      bucket_name: row.bucket_name,
      region: row.region,
      root_folder: row.root_folder,
      access_key_id: decrypted.access_key_id,
      secret_access_key: decrypted.secret_access_key,
      session_token: decrypted.session_token,
      max_upload_size: row.max_upload_size,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_username: row.owner_username,
    };
  });
}

/**
 * Get all buckets for a user
 */
export async function getBucketsByUserId(userId: number): Promise<Bucket[]> {
  const result = await query<any>(
    `SELECT 
      id, user_id, alias, bucket_name, region, root_folder,
      access_key_id as access_key_id_encrypted,
      secret_access_key as secret_access_key_encrypted,
      session_token as session_token_encrypted,
      max_upload_size, is_active, created_at, updated_at
     FROM buckets 
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at DESC`,
    [userId]
  );

  // Decrypt credentials
  return result.rows.map((row) => {
    const decrypted = decryptCredentials({
      access_key_id_encrypted: row.access_key_id_encrypted,
      secret_access_key_encrypted: row.secret_access_key_encrypted,
      session_token_encrypted: row.session_token_encrypted,
    });

    return {
      id: row.id,
      user_id: row.user_id,
      alias: row.alias,
      bucket_name: row.bucket_name,
      region: row.region,
      root_folder: row.root_folder,
      access_key_id: decrypted.access_key_id,
      secret_access_key: decrypted.secret_access_key,
      session_token: decrypted.session_token,
      max_upload_size: row.max_upload_size,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

/**
 * Get a single bucket by ID.
 * Pass isAdmin=true to bypass the user_id ownership check (admin access).
 */
export async function getBucketById(id: number, userId: number, isAdmin = false): Promise<Bucket | null> {
  const result = await query<any>(
    isAdmin
      ? `SELECT
          id, user_id, alias, bucket_name, region, root_folder,
          access_key_id as access_key_id_encrypted,
          secret_access_key as secret_access_key_encrypted,
          session_token as session_token_encrypted,
          max_upload_size, is_active, created_at, updated_at
         FROM buckets
         WHERE id = $1`
      : `SELECT
          id, user_id, alias, bucket_name, region, root_folder,
          access_key_id as access_key_id_encrypted,
          secret_access_key as secret_access_key_encrypted,
          session_token as session_token_encrypted,
          max_upload_size, is_active, created_at, updated_at
         FROM buckets
         WHERE id = $1 AND user_id = $2`,
    isAdmin ? [id] : [id, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const decrypted = decryptCredentials({
    access_key_id_encrypted: row.access_key_id_encrypted,
    secret_access_key_encrypted: row.secret_access_key_encrypted,
    session_token_encrypted: row.session_token_encrypted,
  });

  return {
    id: row.id,
    user_id: row.user_id,
    alias: row.alias,
    bucket_name: row.bucket_name,
    region: row.region,
    root_folder: row.root_folder,
    access_key_id: decrypted.access_key_id,
    secret_access_key: decrypted.secret_access_key,
    session_token: decrypted.session_token,
    max_upload_size: row.max_upload_size,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Create a new bucket
 */
export async function createBucket(input: CreateBucketInput): Promise<Bucket | null> {
  try {
    return await transaction(async (client) => {
      // Encrypt credentials
      const encrypted = encryptCredentials({
        access_key_id: input.access_key_id,
        secret_access_key: input.secret_access_key,
        session_token: input.session_token,
      });

      const result = await client.query<any>(
        `INSERT INTO buckets
         (user_id, alias, bucket_name, region, root_folder, access_key_id, secret_access_key, session_token, max_upload_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING
           id, user_id, alias, bucket_name, region, root_folder,
           access_key_id as access_key_id_encrypted,
           secret_access_key as secret_access_key_encrypted,
           session_token as session_token_encrypted,
           max_upload_size, is_active, created_at, updated_at`,
        [
          input.user_id,
          input.alias,
          input.bucket_name,
          input.region,
          input.root_folder || null,
          encrypted.access_key_id_encrypted || null,
          encrypted.secret_access_key_encrypted || null,
          encrypted.session_token_encrypted || null,
          input.max_upload_size ?? null,
        ]
      );

      const bucket = result.rows[0];

      // Audit log
      await createAuditLog({
        user_id: input.user_id,
        username: input.username,
        action: 'bucket.created',
        resource_type: 'bucket',
        resource_id: bucket.id.toString(),
        details: {
          alias: input.alias,
          bucket_name: input.bucket_name,
          region: input.region,
          has_credentials: !!(input.access_key_id || input.secret_access_key),
        },
        status: 'success',
      });

      // Decrypt for return
      const decrypted = decryptCredentials({
        access_key_id_encrypted: bucket.access_key_id_encrypted,
        secret_access_key_encrypted: bucket.secret_access_key_encrypted,
        session_token_encrypted: bucket.session_token_encrypted,
      });

      return {
        id: bucket.id,
        user_id: bucket.user_id,
        alias: bucket.alias,
        bucket_name: bucket.bucket_name,
        region: bucket.region,
        root_folder: bucket.root_folder,
        access_key_id: decrypted.access_key_id,
        secret_access_key: decrypted.secret_access_key,
        session_token: decrypted.session_token,
        max_upload_size: bucket.max_upload_size,
        is_active: bucket.is_active,
        created_at: bucket.created_at,
        updated_at: bucket.updated_at,
      };
    });
  } catch (error) {
    console.error('Create bucket error:', error);
    return null;
  }
}

/**
 * Update a bucket.
 * Pass isAdmin=true to allow updating buckets owned by other users (admin access).
 */
export async function updateBucket(
  id: number,
  userId: number,
  input: UpdateBucketInput,
  isAdmin = false
): Promise<Bucket | null> {
  try {
    return await transaction(async (client) => {
      // Check ownership (admins bypass user_id filter)
      const existing = await getBucketById(id, userId, isAdmin);
      if (!existing) {
        throw new Error('Bucket not found or access denied');
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.alias !== undefined) {
        updates.push(`alias = $${paramIndex++}`);
        params.push(input.alias);
      }

      if (input.bucket_name !== undefined) {
        updates.push(`bucket_name = $${paramIndex++}`);
        params.push(input.bucket_name);
      }

      if (input.region !== undefined) {
        updates.push(`region = $${paramIndex++}`);
        params.push(input.region);
      }

      if (input.root_folder !== undefined) {
        updates.push(`root_folder = $${paramIndex++}`);
        params.push(input.root_folder || null);
      }

      // Handle credential updates
      if (input.access_key_id !== undefined || input.secret_access_key !== undefined || input.session_token !== undefined) {
        const encrypted = encryptCredentials({
          access_key_id: input.access_key_id,
          secret_access_key: input.secret_access_key,
          session_token: input.session_token,
        });

        if (encrypted.access_key_id_encrypted !== undefined) {
          updates.push(`access_key_id = $${paramIndex++}`);
          params.push(encrypted.access_key_id_encrypted || null);
        }

        if (encrypted.secret_access_key_encrypted !== undefined) {
          updates.push(`secret_access_key = $${paramIndex++}`);
          params.push(encrypted.secret_access_key_encrypted || null);
        }

        if (encrypted.session_token_encrypted !== undefined) {
          updates.push(`session_token = $${paramIndex++}`);
          params.push(encrypted.session_token_encrypted || null);
        }
      }

      if (input.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(input.is_active);
      }

      if (input.max_upload_size !== undefined) {
        updates.push(`max_upload_size = $${paramIndex++}`);
        params.push(input.max_upload_size);
      }

      if (updates.length === 0) {
        return existing; // No updates
      }

      updates.push(`updated_at = NOW()`);
      if (isAdmin) {
        params.push(id);
      } else {
        params.push(id, userId);
      }

      const whereClause = isAdmin
        ? `WHERE id = $${paramIndex++}`
        : `WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`;

      const result = await client.query<any>(
        `UPDATE buckets
         SET ${updates.join(', ')}
         ${whereClause}
         RETURNING
           id, user_id, alias, bucket_name, region, root_folder,
           access_key_id as access_key_id_encrypted,
           secret_access_key as secret_access_key_encrypted,
           session_token as session_token_encrypted,
           max_upload_size, is_active, created_at, updated_at`,
        params
      );

      const bucket = result.rows[0];

      // Audit log
      await createAuditLog({
        user_id: userId,
        username: input.username,
        action: 'bucket.updated',
        resource_type: 'bucket',
        resource_id: id.toString(),
        details: {
          changes: Object.keys(input).filter(k => k !== 'user_id' && k !== 'username'),
        },
        status: 'success',
      });

      // Decrypt for return
      const decrypted = decryptCredentials({
        access_key_id_encrypted: bucket.access_key_id_encrypted,
        secret_access_key_encrypted: bucket.secret_access_key_encrypted,
        session_token_encrypted: bucket.session_token_encrypted,
      });

      return {
        id: bucket.id,
        user_id: bucket.user_id,
        alias: bucket.alias,
        bucket_name: bucket.bucket_name,
        region: bucket.region,
        root_folder: bucket.root_folder,
        access_key_id: decrypted.access_key_id,
        secret_access_key: decrypted.secret_access_key,
        session_token: decrypted.session_token,
        max_upload_size: bucket.max_upload_size,
        is_active: bucket.is_active,
        created_at: bucket.created_at,
        updated_at: bucket.updated_at,
      };
    });
  } catch (error) {
    console.error('Update bucket error:', error);
    return null;
  }
}

/**
 * Delete a bucket (soft delete).
 * Pass isAdmin=true to allow deleting buckets owned by other users (admin access).
 */
export async function deleteBucket(
  id: number,
  userId: number,
  username?: string,
  isAdmin = false
): Promise<boolean> {
  try {
    return await transaction(async (client) => {
      // Check ownership (admins bypass user_id filter)
      const existing = await getBucketById(id, userId, isAdmin);
      if (!existing) {
        return false;
      }

      await client.query(
        isAdmin
          ? 'UPDATE buckets SET is_active = false, updated_at = NOW() WHERE id = $1'
          : 'UPDATE buckets SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        isAdmin ? [id] : [id, userId]
      );

      // Audit log
      await createAuditLog({
        user_id: userId,
        username,
        action: 'bucket.deleted',
        resource_type: 'bucket',
        resource_id: id.toString(),
        details: {
          alias: existing.alias,
          bucket_name: existing.bucket_name,
        },
        status: 'success',
      });

      return true;
    });
  } catch (error) {
    console.error('Delete bucket error:', error);
    return false;
  }
}

/**
 * Hard delete a bucket (permanent)
 */
export async function hardDeleteBucket(
  id: number,
  userId: number,
  username?: string
): Promise<boolean> {
  try {
    return await transaction(async (client) => {
      // Check ownership
      const existing = await getBucketById(id, userId);
      if (!existing) {
        return false;
      }

      await client.query(
        'DELETE FROM buckets WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      // Audit log
      await createAuditLog({
        user_id: userId,
        username,
        action: 'bucket.hard_deleted',
        resource_type: 'bucket',
        resource_id: id.toString(),
        details: {
          alias: existing.alias,
          bucket_name: existing.bucket_name,
        },
        status: 'success',
      });

      return true;
    });
  } catch (error) {
    console.error('Hard delete bucket error:', error);
    return false;
  }
}

/**
 * Get bucket count for a user
 */
export async function getBucketCount(userId: number): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM buckets WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get all active buckets that have been explicitly assigned to a user
 * (i.e. buckets the user does NOT own but has been granted access to).
 * Returns decrypted credentials so the client can connect.
 */
export async function getBucketsAssignedToUser(userId: number): Promise<Bucket[]> {
  const result = await query<any>(
    `SELECT
      b.id, b.user_id, b.alias, b.bucket_name, b.region, b.root_folder,
      b.access_key_id  AS access_key_id_encrypted,
      b.secret_access_key AS secret_access_key_encrypted,
      b.session_token  AS session_token_encrypted,
      b.max_upload_size, b.is_active, b.created_at, b.updated_at,
      u.username AS owner_username,
      ba.permission
     FROM buckets b
     JOIN bucket_assignments ba ON b.id = ba.bucket_id
     JOIN users u ON b.user_id = u.id
     WHERE ba.user_id = $1 AND b.is_active = true
     ORDER BY b.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const decrypted = decryptCredentials({
      access_key_id_encrypted: row.access_key_id_encrypted,
      secret_access_key_encrypted: row.secret_access_key_encrypted,
      session_token_encrypted: row.session_token_encrypted,
    });
    return {
      id: row.id,
      user_id: row.user_id,
      alias: row.alias,
      bucket_name: row.bucket_name,
      region: row.region,
      root_folder: row.root_folder,
      access_key_id: decrypted.access_key_id,
      secret_access_key: decrypted.secret_access_key,
      session_token: decrypted.session_token,
      max_upload_size: row.max_upload_size,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_username: row.owner_username,
      is_owned: false,
      permission: row.permission,
    };
  });
}

/**
 * Upsert a user's access to a bucket into bucket_assignments.
 */
export async function assignBucketToUser(
  bucketId: number,
  userId: number,
  assignedByUserId: number,
  permission: string
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO bucket_assignments (bucket_id, user_id, permission, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bucket_id, user_id)
       DO UPDATE SET permission = EXCLUDED.permission, assigned_by = EXCLUDED.assigned_by`,
      [bucketId, userId, permission, assignedByUserId]
    );
    return true;
  } catch (error) {
    console.error('assignBucketToUser error:', error);
    return false;
  }
}

/**
 * Remove a user's assignment from a bucket.
 */
export async function removeBucketAssignment(
  bucketId: number,
  userId: number
): Promise<boolean> {
  try {
    await query(
      'DELETE FROM bucket_assignments WHERE bucket_id = $1 AND user_id = $2',
      [bucketId, userId]
    );
    return true;
  } catch (error) {
    console.error('removeBucketAssignment error:', error);
    return false;
  }
}

/**
 * Get all user assignments for a single bucket (with username + role).
 */
export async function getAssignmentsByBucketId(bucketId: number): Promise<BucketAssignmentRecord[]> {
  const result = await query<any>(
    `SELECT ba.id, ba.bucket_id, ba.user_id, ba.permission, ba.assigned_by, ba.created_at,
            u.username, u.role
     FROM bucket_assignments ba
     JOIN users u ON ba.user_id = u.id
     WHERE ba.bucket_id = $1
     ORDER BY ba.created_at ASC`,
    [bucketId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    bucket_id: row.bucket_id,
    user_id: row.user_id,
    username: row.username,
    role: row.role,
    permission: row.permission,
    assigned_by: row.assigned_by,
    created_at: row.created_at,
  }));
}

/**
 * Get every bucket assignment across all buckets (admin use).
 */
export async function getAllBucketAssignments(): Promise<BucketAssignmentRecord[]> {
  const result = await query<any>(
    `SELECT ba.id, ba.bucket_id, ba.user_id, ba.permission, ba.assigned_by, ba.created_at,
            u.username, u.role
     FROM bucket_assignments ba
     JOIN users u ON ba.user_id = u.id
     ORDER BY ba.bucket_id, ba.created_at ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    bucket_id: row.bucket_id,
    user_id: row.user_id,
    username: row.username,
    role: row.role,
    permission: row.permission,
    assigned_by: row.assigned_by,
    created_at: row.created_at,
  }));
}
