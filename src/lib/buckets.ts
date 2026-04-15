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
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBucketInput {
  alias: string;
  bucket_name: string;
  region: string;
  root_folder?: string;
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
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
      id, user_id, alias, bucket_name, region, root_folder,
      access_key_id as access_key_id_encrypted,
      secret_access_key as secret_access_key_encrypted,
      session_token as session_token_encrypted,
      is_active, created_at, updated_at
     FROM buckets
     WHERE is_active = true
     ORDER BY created_at DESC`
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
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
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
      is_active, created_at, updated_at
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
          is_active, created_at, updated_at
         FROM buckets
         WHERE id = $1`
      : `SELECT
          id, user_id, alias, bucket_name, region, root_folder,
          access_key_id as access_key_id_encrypted,
          secret_access_key as secret_access_key_encrypted,
          session_token as session_token_encrypted,
          is_active, created_at, updated_at
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
         (user_id, alias, bucket_name, region, root_folder, access_key_id, secret_access_key, session_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING 
           id, user_id, alias, bucket_name, region, root_folder,
           access_key_id as access_key_id_encrypted,
           secret_access_key as secret_access_key_encrypted,
           session_token as session_token_encrypted,
           is_active, created_at, updated_at`,
        [
          input.user_id,
          input.alias,
          input.bucket_name,
          input.region,
          input.root_folder || null,
          encrypted.access_key_id_encrypted || null,
          encrypted.secret_access_key_encrypted || null,
          encrypted.session_token_encrypted || null,
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
           is_active, created_at, updated_at`,
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
