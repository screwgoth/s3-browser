/**
 * Server-side authorization for mutating S3 operations.
 *
 * Unlike the read/upload actions in `src/actions/s3.ts`, which accept a bucket
 * config (credentials included) from the client, these operations take only a
 * bucket ID. Credentials are resolved and decrypted server-side after the
 * caller's session, role, and access to that bucket have all been verified.
 */

import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { getCurrentUserOptional } from './session';
import { getBucketById, type Bucket } from './buckets';
import { query } from './db';
import { createAuditLog } from './audit';
import { normalizeRoot } from './s3-keys';

export type MutationOp = 'create-folder' | 'move' | 'delete';

const ALLOWED_ROLES: Record<MutationOp, string[]> = {
  'create-folder': ['uploader', 'bucket-creator', 'admin'],
  move: ['uploader', 'bucket-creator', 'admin'],
  delete: ['admin'],
};

/**
 * Deliberately identical for "wrong role" and "no such bucket" so a caller
 * cannot use the response to probe which buckets exist.
 */
const DENIED = 'Not authorized.';

export class NotAuthorizedError extends Error {
  constructor() {
    super(DENIED);
    this.name = 'NotAuthorizedError';
  }
}

export interface MutationContext {
  user: { id: number; username: string; role: string };
  bucket: Bucket;
  s3Client: S3Client;
  /** Normalized bucket root ('' when the whole bucket is visible). */
  root: string;
}

/** True when the user owns the bucket or has it assigned to them. */
async function hasBucketAccess(bucketId: number, userId: number): Promise<boolean> {
  const result = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM buckets WHERE id = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM bucket_assignments WHERE bucket_id = $1 AND user_id = $2
     ) AS ok`,
    [bucketId, userId]
  );
  return result.rows[0]?.ok === true;
}

function buildS3Client(bucket: Bucket): S3Client {
  const options: S3ClientConfig = { region: bucket.region };
  if (bucket.access_key_id && bucket.secret_access_key) {
    options.credentials = {
      accessKeyId: bucket.access_key_id,
      secretAccessKey: bucket.secret_access_key,
      sessionToken: bucket.session_token,
    };
  }
  return new S3Client(options);
}

/**
 * Verify the caller may perform `op` on `bucketId`, and return everything the
 * action needs. Throws `NotAuthorizedError` on any failure, after recording an
 * audit entry.
 */
export async function resolveBucketForMutation(
  bucketId: string,
  op: MutationOp
): Promise<MutationContext> {
  const user = await getCurrentUserOptional();
  const id = Number(bucketId);

  const deny = async (reason: string) => {
    await createAuditLog({
      user_id: user?.id,
      username: user?.username,
      action: `s3.${op}.denied`,
      resource_type: 'bucket',
      resource_id: bucketId,
      details: { reason, bucket_id: bucketId, role: user?.role ?? null },
      status: 'failure',
    });
    return new NotAuthorizedError();
  };

  if (!user) throw await deny('no_session');
  if (!Number.isInteger(id) || id <= 0) throw await deny('invalid_bucket_id');

  const role = user.role ?? 'viewer';
  if (!ALLOWED_ROLES[op].includes(role)) throw await deny('insufficient_role');

  const isAdmin = role === 'admin';
  if (!isAdmin && !(await hasBucketAccess(id, user.id))) {
    throw await deny('no_bucket_access');
  }

  // Access is already established, so fetch with the admin query to cover
  // assigned (non-owned) buckets as well as owned ones.
  const bucket = await getBucketById(id, user.id, true);
  if (!bucket) throw await deny('bucket_not_found');
  if (!bucket.is_active) throw await deny('bucket_inactive');

  return {
    user: { id: user.id, username: user.username, role },
    bucket,
    s3Client: buildS3Client(bucket),
    root: normalizeRoot(bucket.root_folder),
  };
}
