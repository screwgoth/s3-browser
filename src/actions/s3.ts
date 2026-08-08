'use server';

import { S3Client, ListObjectsV2Command, GetObjectCommand, ListObjectsV2CommandOutput, _Object, GetObjectCommandOutput, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { Bucket } from "@/context/BucketContext";
import JSZip from "jszip";
import { getCurrentUserOptional } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { effectiveMaxUploadSize } from "@/lib/upload-limits";
import { scanBuffer } from "@/lib/malware-scan";
import { markObjectUnscanned, clearUnscannedFlag, getUnscannedKeys, markObjectClean, clearCleanFlag, getCleanKeys } from "@/lib/scan-status";

const S3ConfigSchema = z.object({
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  region: z.string().min(1, { message: "Region is required." }),
  bucket: z.string().min(1, { message: "Bucket name is required." }),
});

type S3Config = z.infer<typeof S3ConfigSchema>;

function getS3Client(config: S3Config): S3Client {
    const s3ClientOptions: S3ClientConfig = {
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      s3ClientOptions.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      };
    }
    return new S3Client(s3ClientOptions);
}

export async function listObjects(
  config: Bucket,
  prefix: string,
  options?: { limit?: number; continuationToken?: string }
): Promise<{
  folders: { Prefix: string }[];
  files: { Key?: string; LastModified?: Date; Size?: number; scanStatus?: 'unscanned' | 'clean' }[];
  nextContinuationToken?: string;
  isComplete: boolean;
}> {
  const s3Client = getS3Client(config);
  const folders: { Prefix: string }[] = [];
  const files: { Key?: string; LastModified?: Date; Size?: number; scanStatus?: 'unscanned' | 'clean' }[] = [];
  let continuationToken: string | undefined = options?.continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      Delimiter: "/",
      ContinuationToken: continuationToken,
      ...(options?.limit !== undefined ? { MaxKeys: options.limit } : {}),
    });
    const response = await s3Client.send(command);

    for (const p of response.CommonPrefixes || []) {
      if (p.Prefix) folders.push({ Prefix: p.Prefix });
    }
    for (const c of response.Contents || []) {
      if (c.Key !== prefix && (c.Size ?? 0) > 0) {
        files.push({ Key: c.Key, LastModified: c.LastModified, Size: c.Size });
      }
    }

    continuationToken = response.NextContinuationToken;

    // When a limit is set, only fetch one page then return
    if (options?.limit !== undefined) break;
  } while (continuationToken);

  // Annotate files with their malware-scan status: 'unscanned' (fail-open) or
  // 'clean' (scanned OK). Files in neither set are left undefined (unknown).
  const bucketId = Number(config.id);
  if (!Number.isNaN(bucketId) && files.length > 0) {
    try {
      const keys = files.map((f) => f.Key).filter((k): k is string => !!k);
      const [unscanned, clean] = await Promise.all([
        getUnscannedKeys(bucketId, keys),
        getCleanKeys(bucketId, keys),
      ]);
      if (unscanned.size > 0 || clean.size > 0) {
        for (const f of files) {
          if (!f.Key) continue;
          if (unscanned.has(f.Key)) f.scanStatus = 'unscanned';
          else if (clean.has(f.Key)) f.scanStatus = 'clean';
        }
      }
    } catch (e) {
      console.error('[listObjects] Failed to load scan status:', e);
    }
  }

  return { folders, files, nextContinuationToken: continuationToken, isComplete: !continuationToken };
}

export async function validateS3Connection(config: S3Config): Promise<{ success: boolean; message: string }> {
  try {
    const validatedConfig = S3ConfigSchema.parse(config);
    const s3Client = getS3Client(validatedConfig);

    const command = new ListObjectsV2Command({
      Bucket: validatedConfig.bucket,
      MaxKeys: 1,
    });

    await s3Client.send(command);

    return { success: true, message: "Connection successful!" };
  } catch (error: any) {
    let errorMessage = "An unknown error occurred.";

    if (error.name === 'NoSuchBucket') {
      errorMessage = `Bucket "${config.bucket}" does not exist in region "${config.region}".`;
    } else if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      errorMessage = "Invalid AWS Access Key ID or Secret Access Key.";
    } else if (error.code === 'PermanentRedirect') {
      errorMessage = `The bucket is in a different region. Please verify the bucket's region.`;
    } else if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
        errorMessage = `Access Denied. If this is a public bucket, leave credentials empty. Otherwise, please check your credentials and bucket permissions.`;
    } else if (error instanceof z.ZodError) {
      errorMessage = "Invalid input data.";
    } else {
       errorMessage = error.message || "Failed to connect to S3.";
    }
    
    console.error("S3 Connection Error:", error);
    return { success: false, message: errorMessage };
  }
}

export async function getObjectUrl(config: Bucket, key: string): Promise<string> {
  const s3Client = getS3Client(config);
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour
  const user = await getCurrentUserOptional();
  await createAuditLog({
    user_id: user?.id,
    username: user?.username,
    action: 'file.download',
    resource_type: 's3_object',
    resource_id: key,
    details: { bucket: config.bucket, key, method: 'presigned_url' },
    status: 'success',
  });
  return url;
}

export async function getObjectContent(
  config: Bucket,
  key: string
): Promise<{ base64: string; contentType: string }> {
  const s3Client = getS3Client(config);
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  const response = await s3Client.send(command);
  const buffer = await streamToBuffer(response.Body);
  const base64 = buffer.toString("base64");
  const contentType = response.ContentType || "application/octet-stream";
  const user = await getCurrentUserOptional();
  await createAuditLog({
    user_id: user?.id,
    username: user?.username,
    action: 'file.download',
    resource_type: 's3_object',
    resource_id: key,
    details: { bucket: config.bucket, key, method: 'content', content_type: contentType },
    status: 'success',
  });
  return { base64, contentType };
}

async function streamToBuffer(stream: GetObjectCommandOutput['Body']): Promise<Buffer> {
    if (!stream) {
        return Buffer.alloc(0);
    }
    const byteArray = await stream.transformToByteArray();
    return Buffer.from(byteArray);
}

export async function getFolderContentsAsZip(config: Bucket, prefix: string): Promise<string> {
    const s3Client = getS3Client(config);
    const zip = new JSZip();
    let continuationToken: string | undefined = undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });
        const response: ListObjectsV2CommandOutput = await s3Client.send(command);

        if (response.Contents) {
            for (const item of response.Contents) {
                if (item.Key && item.Size! > 0) { // Don't add empty objects (like folders)
                    const getObjectCmd = new GetObjectCommand({ Bucket: config.bucket, Key: item.Key });
                    const objectResponse = await s3Client.send(getObjectCmd);

                    if (objectResponse.Body) {
                        const buffer = await streamToBuffer(objectResponse.Body);
                        // Make sure the path in zip is relative to the folder being downloaded
                        const relativePath = item.Key.replace(prefix, "");
                        zip.file(relativePath, buffer);
                    }
                }
            }
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    const content = await zip.generateAsync({ type: "base64" });
    const user = await getCurrentUserOptional();
    await createAuditLog({
      user_id: user?.id,
      username: user?.username,
      action: 'file.download.folder',
      resource_type: 's3_object',
      resource_id: prefix,
      details: { bucket: config.bucket, prefix },
      status: 'success',
    });
    return content;
}

async function fetchAllObjectKeys(s3Client: S3Client, bucket: string, prefix: string): Promise<_Object[]> {
    let allObjects: _Object[] = [];
    let continuationToken: string | undefined = undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });
        const response: ListObjectsV2CommandOutput = await s3Client.send(command);
        if (response.Contents) {
            allObjects = allObjects.concat(response.Contents);
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return allObjects;
}

export async function getItemsAsZip(config: Bucket, items: {key: string, type: 'file' | 'folder'}[]): Promise<string> {
    const s3Client = getS3Client(config);
    const zip = new JSZip();

    // Find the common base path for all selected items
    const allPaths = items.map(item => item.key);
    const commonPrefix = allPaths.reduce((a, b) => {
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        return a.substring(0, i);
    }).replace(/[^/]*$/, ''); // a.k.a dirname

    for (const item of items) {
        if (item.type === 'folder') {
            const objectsInFolder = await fetchAllObjectKeys(s3Client, config.bucket, item.key);
            for (const obj of objectsInFolder) {
                 if (obj.Key && obj.Size! > 0) {
                    const getObjectCmd = new GetObjectCommand({ Bucket: config.bucket, Key: obj.Key });
                    const objectResponse = await s3Client.send(getObjectCmd);
                    if (objectResponse.Body) {
                        const buffer = await streamToBuffer(objectResponse.Body);
                        const zipPath = obj.Key.replace(commonPrefix, '');
                        zip.file(zipPath, buffer);
                    }
                }
            }
        } else { // It's a file
            if (item.key) {
                const getObjectCmd = new GetObjectCommand({ Bucket: config.bucket, Key: item.key });
                const objectResponse = await s3Client.send(getObjectCmd);
                 if (objectResponse.Body) {
                    const buffer = await streamToBuffer(objectResponse.Body);
                    const zipPath = item.key.replace(commonPrefix, '');
                    zip.file(zipPath, buffer);
                }
            }
        }
    }

    const content = await zip.generateAsync({ type: "base64" });
    const user = await getCurrentUserOptional();
    await createAuditLog({
      user_id: user?.id,
      username: user?.username,
      action: 'file.download.batch',
      resource_type: 's3_object',
      resource_id: config.bucket,
      details: {
        bucket: config.bucket,
        item_count: items.length,
        keys: items.map(i => i.key),
      },
      status: 'success',
    });
    return content;
}

export async function uploadObject(
    config: Bucket,
    file: File,
    key: string,
    onProgress?: (progress: number) => void
): Promise<{ success: boolean; message: string }> {
    try {
        // Validate file size against the bucket's configured limit (default 10MB).
        const maxSize = effectiveMaxUploadSize(config.maxUploadSize);
        if (file.size > maxSize) {
            return {
                success: false,
                message: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds the ${(maxSize / (1024 * 1024)).toFixed(0)}MB limit for this bucket.`
            };
        }

        const s3Client = getS3Client(config);

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const user = await getCurrentUserOptional();
        const bucketId = Number(config.id);

        // Malware scan BEFORE upload. Infected files are rejected outright;
        // if the scanner is unavailable we fail open (see scanBuffer).
        const scan = await scanBuffer(buffer);
        if (scan.status === 'infected') {
            await createAuditLog({
              user_id: user?.id,
              username: user?.username,
              action: 'file.upload.blocked',
              resource_type: 's3_object',
              resource_id: key,
              details: {
                bucket: config.bucket,
                key,
                size_bytes: file.size,
                reason: 'malware_detected',
                viruses: scan.viruses ?? [],
              },
              status: 'failure',
            });
            const names = scan.viruses?.length ? ` (${scan.viruses.join(', ')})` : '';
            return {
                success: false,
                message: `File "${file.name}" failed the malware scan${names} and was not uploaded.`,
            };
        }

        const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
            ContentLength: file.size,
        });

        await s3Client.send(command);

        // Track scan status so the browser can flag files. The unscanned and
        // clean records are mutually exclusive — a re-upload flips one to the
        // other, so we always clear the opposite flag.
        if (!Number.isNaN(bucketId)) {
            try {
                if (scan.status === 'unscanned') {
                    await markObjectUnscanned(bucketId, key, scan.error);
                    await clearCleanFlag(bucketId, key);
                } else {
                    await markObjectClean(bucketId, key);
                    await clearUnscannedFlag(bucketId, key);
                }
            } catch (e) {
                console.error('[Upload] Failed to record scan status:', e);
            }
        }
        if (scan.status === 'unscanned') {
            console.warn(`[Upload] Object uploaded WITHOUT malware scan (fail-open): ${config.bucket}/${key} — ${scan.error ?? 'scanner unavailable'}`);
        }

        await createAuditLog({
          user_id: user?.id,
          username: user?.username,
          action: 'file.upload',
          resource_type: 's3_object',
          resource_id: key,
          details: {
            bucket: config.bucket,
            key,
            size_bytes: file.size,
            content_type: file.type || 'application/octet-stream',
            scan_status: scan.status,
            ...(scan.status === 'unscanned' ? { scan_error: scan.error } : {}),
          },
          status: 'success',
        });

        return {
            success: true,
            message:
              scan.status === 'unscanned'
                ? `File "${file.name}" uploaded, but could not be malware-scanned.`
                : `File "${file.name}" uploaded successfully.`,
        };
    } catch (error: any) {
        console.error("Upload error:", error);
        return {
            success: false,
            message: error.message || "Failed to upload file."
        };
    }
}
