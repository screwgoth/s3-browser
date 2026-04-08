'use server';

import { S3Client, ListObjectsV2Command, GetObjectCommand, ListObjectsV2CommandOutput, _Object, GetObjectCommandOutput, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { Bucket } from "@/context/BucketContext";
import JSZip from "jszip";

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
  prefix: string
): Promise<{ folders: { Prefix: string }[]; files: { Key?: string; LastModified?: Date; Size?: number }[] }> {
  const s3Client = getS3Client(config);
  const folders: { Prefix: string }[] = [];
  const files: { Key?: string; LastModified?: Date; Size?: number }[] = [];
  let continuationToken: string | undefined = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      Delimiter: "/",
      ContinuationToken: continuationToken,
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
  } while (continuationToken);

  return { folders, files };
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
    return content;
}

export async function uploadObject(
    config: Bucket, 
    file: File, 
    key: string,
    onProgress?: (progress: number) => void
): Promise<{ success: boolean; message: string }> {
    try {
        // Validate file size (100MB limit)
        const maxSize = 100 * 1024 * 1024; // 100MB in bytes
        if (file.size > maxSize) {
            return { 
                success: false, 
                message: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds the 100MB limit.` 
            };
        }

        const s3Client = getS3Client(config);
        
        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const command = new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: buffer,
            ContentType: file.type || 'application/octet-stream',
            ContentLength: file.size,
        });

        await s3Client.send(command);
        
        return { 
            success: true, 
            message: `File "${file.name}" uploaded successfully.` 
        };
    } catch (error: any) {
        console.error("Upload error:", error);
        return { 
            success: false, 
            message: error.message || "Failed to upload file." 
        };
    }
}
