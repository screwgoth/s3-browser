'use server';

/**
 * Mutating S3 Server Actions: create folder, move files, delete items.
 *
 * These take a bucket ID rather than a client-supplied config; credentials are
 * resolved server-side by `resolveBucketForMutation`, which also enforces the
 * caller's role. See `src/lib/s3-authz.ts`.
 */

import {
  PutObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { resolveBucketForMutation, NotAuthorizedError } from '@/lib/s3-authz';
import {
  assertWithinRoot,
  destinationKeyFor,
  isRootPrefix,
  validateFolderName,
  UnsafeKeyError,
} from '@/lib/s3-keys';
import { createAuditLog } from '@/lib/audit';
import { moveScanStatus, clearScanStatusForKeys } from '@/lib/scan-status';

/** S3 DeleteObjects accepts at most 1000 keys per call. */
const DELETE_BATCH_SIZE = 1000;

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface MoveResult {
  success: boolean;
  message: string;
  moved: string[];
  skipped: { key: string; reason: string }[];
  failed: { key: string; error: string }[];
}

export interface DeleteResult {
  success: boolean;
  message: string;
  deletedCount: number;
  failed: { key: string; error: string }[];
}

export interface DeletePreview {
  objectCount: number;
  totalBytes: number;
}

export type MutableItem = { key: string; type: 'file' | 'folder' };

/**
 * Translate an internal error into something safe to show the user. AWS errors
 * can carry bucket ARNs and credential hints, so they are logged but not
 * returned verbatim.
 */
function clientMessage(error: unknown, fallback: string): string {
  if (error instanceof NotAuthorizedError) return error.message;
  if (error instanceof UnsafeKeyError) return 'Invalid object path.';
  console.error('[s3-mutations]', error);
  return fallback;
}

/** List every object key under a prefix, following pagination. */
async function listAllUnderPrefix(
  s3Client: import('@aws-sdk/client-s3').S3Client,
  bucket: string,
  prefix: string
): Promise<{ Key: string; Size: number }[]> {
  const out: { Key: string; Size: number }[] = [];
  let continuationToken: string | undefined;

  do {
    const response: ListObjectsV2CommandOutput = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const item of response.Contents ?? []) {
      if (item.Key) out.push({ Key: item.Key, Size: item.Size ?? 0 });
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return out;
}

/** True when an object already exists at `key`. */
async function objectExists(
  s3Client: import('@aws-sdk/client-s3').S3Client,
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error: any) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Create folder
// ---------------------------------------------------------------------------

export async function createFolder(
  bucketId: string,
  prefix: string,
  name: string
): Promise<ActionResult> {
  try {
    const { s3Client, bucket, root, user } = await resolveBucketForMutation(
      bucketId,
      'create-folder'
    );

    const validated = validateFolderName(name);
    if (!validated.ok) {
      return { success: false, message: validated.message };
    }

    // An empty prefix means the bucket's visible root.
    const parent = prefix === '' ? root : prefix;
    const key = `${parent}${validated.value}/`;
    assertWithinRoot(root, key);

    // S3 has no directories; an empty folder is a zero-byte object ending in '/'.
    const existing = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucket.bucket_name, Prefix: key, MaxKeys: 1 })
    );
    if ((existing.KeyCount ?? 0) > 0) {
      return {
        success: false,
        message: `A folder named "${validated.value}" already exists here.`,
      };
    }

    await s3Client.send(
      new PutObjectCommand({ Bucket: bucket.bucket_name, Key: key, Body: '' })
    );

    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'folder.create',
      resource_type: 's3_object',
      resource_id: key,
      details: { bucket: bucket.bucket_name, key },
      status: 'success',
    });

    return { success: true, message: `Folder "${validated.value}" created.` };
  } catch (error) {
    return { success: false, message: clientMessage(error, 'Failed to create folder.') };
  }
}

// ---------------------------------------------------------------------------
// Move files
// ---------------------------------------------------------------------------

export async function moveObjects(
  bucketId: string,
  keys: string[],
  destinationPrefix: string
): Promise<MoveResult> {
  const moved: string[] = [];
  const skipped: { key: string; reason: string }[] = [];
  const failed: { key: string; error: string }[] = [];

  try {
    const { s3Client, bucket, root, user } = await resolveBucketForMutation(bucketId, 'move');

    const destination = destinationPrefix === '' ? root : destinationPrefix;
    if (destination !== root) {
      assertWithinRoot(root, destination);
    }

    for (const key of keys) {
      try {
        if (key.endsWith('/')) {
          skipped.push({ key, reason: 'Folders cannot be moved.' });
          continue;
        }
        assertWithinRoot(root, key);

        const target = destinationKeyFor(key, destination);
        assertWithinRoot(root, target);

        if (target === key) {
          skipped.push({ key, reason: 'Already in this folder.' });
          continue;
        }
        if (await objectExists(s3Client, bucket.bucket_name, target)) {
          skipped.push({ key, reason: 'A file with that name already exists there.' });
          continue;
        }

        // Copy first, delete second: a failure here leaves the source intact.
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: bucket.bucket_name,
            CopySource: encodeURI(`${bucket.bucket_name}/${key}`),
            Key: target,
          })
        );
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucket.bucket_name, Key: key })
        );

        try {
          await moveScanStatus(bucket.id, key, target);
        } catch (e) {
          console.error('[moveObjects] Failed to move scan status:', e);
        }

        moved.push(key);
        await createAuditLog({
          user_id: user.id,
          username: user.username,
          action: 'file.move',
          resource_type: 's3_object',
          resource_id: key,
          details: { bucket: bucket.bucket_name, from: key, to: target },
          status: 'success',
        });
      } catch (error) {
        failed.push({ key, error: clientMessage(error, 'Move failed.') });
      }
    }

    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'file.move.batch',
      resource_type: 's3_object',
      resource_id: bucket.bucket_name,
      details: {
        bucket: bucket.bucket_name,
        destination,
        moved: moved.length,
        skipped: skipped.length,
        failed: failed.length,
      },
      status: failed.length > 0 ? 'failure' : 'success',
    });

    const parts = [`${moved.length} moved`];
    if (skipped.length) parts.push(`${skipped.length} skipped`);
    if (failed.length) parts.push(`${failed.length} failed`);

    return {
      success: failed.length === 0,
      message: parts.join(', '),
      moved,
      skipped,
      failed,
    };
  } catch (error) {
    return {
      success: false,
      message: clientMessage(error, 'Failed to move files.'),
      moved,
      skipped,
      failed,
    };
  }
}

// ---------------------------------------------------------------------------
// Delete (admin only)
// ---------------------------------------------------------------------------

/**
 * Expand a selection into the concrete object keys a delete would remove.
 * Shared by `previewDelete` and `deleteItems` so the count shown to the admin
 * is produced by the same logic that performs the deletion.
 */
async function expandForDelete(
  s3Client: import('@aws-sdk/client-s3').S3Client,
  bucketName: string,
  root: string,
  items: MutableItem[],
  needSizes = false
): Promise<{ Key: string; Size: number }[]> {
  const collected: { Key: string; Size: number }[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (item.type === 'folder') {
      // Refuse anything that would empty the bucket outright.
      if (isRootPrefix(root, item.key)) {
        throw new UnsafeKeyError('Refusing to delete the bucket root.');
      }
      assertWithinRoot(root, item.key);
      for (const obj of await listAllUnderPrefix(s3Client, bucketName, item.key)) {
        assertWithinRoot(root, obj.Key);
        if (!seen.has(obj.Key)) {
          seen.add(obj.Key);
          collected.push(obj);
        }
      }
    } else {
      assertWithinRoot(root, item.key);
      if (!seen.has(item.key)) {
        seen.add(item.key);
        // Sizes cost a HEAD per file, so only fetch them for the preview.
        let size = 0;
        if (needSizes) {
          try {
            const head = await s3Client.send(
              new HeadObjectCommand({ Bucket: bucketName, Key: item.key })
            );
            size = head.ContentLength ?? 0;
          } catch {
            size = 0;
          }
        }
        collected.push({ Key: item.key, Size: size });
      }
    }
  }

  return collected;
}

export async function previewDelete(
  bucketId: string,
  items: MutableItem[]
): Promise<{ success: boolean; message?: string; preview?: DeletePreview }> {
  try {
    // Gated identically to the delete itself, so this cannot be used by a
    // non-admin to enumerate bucket contents.
    const { s3Client, bucket, root } = await resolveBucketForMutation(bucketId, 'delete');
    const keys = await expandForDelete(s3Client, bucket.bucket_name, root, items, true);
    return {
      success: true,
      preview: {
        objectCount: keys.length,
        totalBytes: keys.reduce((sum, k) => sum + k.Size, 0),
      },
    };
  } catch (error) {
    return { success: false, message: clientMessage(error, 'Failed to inspect selection.') };
  }
}

export async function deleteItems(
  bucketId: string,
  items: MutableItem[]
): Promise<DeleteResult> {
  try {
    const { s3Client, bucket, root, user } = await resolveBucketForMutation(bucketId, 'delete');

    const objects = await expandForDelete(s3Client, bucket.bucket_name, root, items);
    if (objects.length === 0) {
      return { success: true, message: 'Nothing to delete.', deletedCount: 0, failed: [] };
    }

    const failed: { key: string; error: string }[] = [];
    const deletedKeys: string[] = [];

    for (let i = 0; i < objects.length; i += DELETE_BATCH_SIZE) {
      const batch = objects.slice(i, i + DELETE_BATCH_SIZE);
      const response = await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket.bucket_name,
          Delete: { Objects: batch.map((o) => ({ Key: o.Key })), Quiet: false },
        })
      );
      for (const d of response.Deleted ?? []) {
        if (d.Key) deletedKeys.push(d.Key);
      }
      for (const e of response.Errors ?? []) {
        failed.push({ key: e.Key ?? '(unknown)', error: e.Message ?? 'Delete failed.' });
      }
    }

    try {
      await clearScanStatusForKeys(bucket.id, deletedKeys);
    } catch (e) {
      console.error('[deleteItems] Failed to clear scan status:', e);
    }

    for (const item of items) {
      await createAuditLog({
        user_id: user.id,
        username: user.username,
        action: item.type === 'folder' ? 'folder.delete' : 'file.delete',
        resource_type: 's3_object',
        resource_id: item.key,
        details: { bucket: bucket.bucket_name, key: item.key },
        status: 'success',
      });
    }
    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'file.delete.batch',
      resource_type: 's3_object',
      resource_id: bucket.bucket_name,
      details: {
        bucket: bucket.bucket_name,
        selection: items,
        deleted_count: deletedKeys.length,
        failed_count: failed.length,
        keys: deletedKeys,
      },
      status: failed.length > 0 ? 'failure' : 'success',
    });

    return {
      success: failed.length === 0,
      message:
        failed.length === 0
          ? `Deleted ${deletedKeys.length} object${deletedKeys.length === 1 ? '' : 's'}.`
          : `Deleted ${deletedKeys.length}, ${failed.length} failed.`,
      deletedCount: deletedKeys.length,
      failed,
    };
  } catch (error) {
    return {
      success: false,
      message: clientMessage(error, 'Failed to delete.'),
      deletedCount: 0,
      failed: [],
    };
  }
}
