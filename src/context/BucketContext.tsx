"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { recordBucketEvent } from '@/actions/audit-record';
import type { BucketPermission } from './BucketAssignmentContext';

export interface Bucket {
  id: string;
  name: string;
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  status: 'untested' | 'connected' | 'failed';
  owner?: string;
  folder?: string;
  maxUploadSize?: number | null;
}

export interface BucketWithPermission extends Bucket {
  permission?: BucketPermission;
  isOwner: boolean;
}

interface BucketContextType {
  buckets: BucketWithPermission[];
  allBuckets: Bucket[];
  selectedBucket: BucketWithPermission | null;
  addBucket: (bucket: Omit<Bucket, 'id'>) => void;
  updateBucket: (id: string, bucket: Omit<Bucket, 'id'>) => void;
  deleteBucket: (id: string) => void;
  setSelectedBucket: (bucket: BucketWithPermission | null) => void;
  getBucketById: (id: string) => BucketWithPermission | undefined;
  setBucketStatus: (id: string, status: Bucket['status']) => void;
  canEditBucket: (bucketId: string) => boolean;
  canDeleteBucket: (bucketId: string) => boolean;
  canUploadToBucket: (bucketId: string) => boolean;
  refreshBuckets: () => Promise<void>;
  /** True while the authenticated user's buckets have not yet been fetched. */
  isLoading: boolean;
  /** Set when the last bucket fetch failed for a reason other than auth (401). */
  loadError: boolean;
}

const BucketContext = createContext<BucketContextType | undefined>(undefined);

/** Map a raw API/DB bucket row to the context's Bucket shape. */
function mapRow(row: any, statusMap: Record<string, Bucket['status']>): BucketWithPermission {
  const id = String(row.id);
  return {
    id,
    name: row.alias,
    bucket: row.bucket_name,
    region: row.region,
    accessKeyId: row.access_key_id,
    secretAccessKey: row.secret_access_key,
    sessionToken: row.session_token,
    folder: row.root_folder,
    maxUploadSize: row.max_upload_size,
    owner: row.owner_username,
    status: statusMap[id] ?? 'untested',
    isOwner: row.is_owned ?? true,
    permission: row.permission ?? undefined,
  };
}

export function BucketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, Bucket['status']>>({});
  const [selectedBucket, setSelectedBucket] = useState<BucketWithPermission | null>(null);
  // Username the current rawRows were fetched for. Buckets are considered
  // "loading" whenever there is an authenticated user whose buckets have not
  // yet been fetched — this lets the UI show a spinner instead of a
  // misleading empty list while the fetch is in flight.
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const refreshBuckets = useCallback(async () => {
    if (!user) { setRawRows([]); setFetchedFor(null); return; }
    try {
      const res = await fetch('/api/buckets', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRawRows(data.buckets ?? []);
        setLoadError(false);
      } else if (res.status === 401) {
        setRawRows([]);
        setLoadError(false);
      } else {
        // A non-auth failure (5xx, etc.) must be distinguishable from "no
        // buckets" so the UI can show an error+retry instead of an empty state.
        setLoadError(true);
      }
    } catch (e) {
      console.error('BucketContext: failed to load buckets', e);
      setLoadError(true);
    } finally {
      setFetchedFor(user.username);
    }
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading = there is a user but rawRows haven't been fetched for them yet.
  const isLoading = !!user && fetchedFor !== user.username;

  // Reload whenever the logged-in user changes.
  useEffect(() => { refreshBuckets(); }, [refreshBuckets]);

  // Reload when the browser tab regains focus so newly-assigned buckets appear
  // without the user needing to manually refresh the page.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshBuckets(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshBuckets]);

  const userBuckets: BucketWithPermission[] = React.useMemo(
    () => rawRows.map(r => mapRow(r, statusMap)),
    [rawRows, statusMap]
  );

  // allBuckets exposes the same rows as plain Bucket[] (no isOwner/permission)
  // used by admin-only pages such as bucket-assignments.
  const allBuckets: Bucket[] = React.useMemo(
    () => rawRows.map(r => ({
      id: String(r.id),
      name: r.alias,
      bucket: r.bucket_name,
      region: r.region,
      accessKeyId: r.access_key_id,
      secretAccessKey: r.secret_access_key,
      sessionToken: r.session_token,
      folder: r.root_folder,
      maxUploadSize: r.max_upload_size,
      owner: r.owner_username,
      status: statusMap[String(r.id)] ?? 'untested',
    })),
    [rawRows, statusMap]
  );

  const addBucket = (bucket: Omit<Bucket, 'id'>) => {
    if (!user) return;
    (async () => {
      const res = await fetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          alias: bucket.name,
          bucket_name: bucket.bucket,
          region: bucket.region,
          root_folder: bucket.folder,
          access_key_id: bucket.accessKeyId,
          secret_access_key: bucket.secretAccessKey,
          session_token: bucket.sessionToken,
          max_upload_size: bucket.maxUploadSize,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshBuckets();
        recordBucketEvent('bucket.created', String(data.bucket?.id ?? ''), {
          name: bucket.name,
          bucket: bucket.bucket,
          region: bucket.region,
        });
      }
    })();
  };

  const updateBucket = (id: string, updatedBucket: Omit<Bucket, 'id'>) => {
    const existing = rawRows.find(r => String(r.id) === id);
    (async () => {
      const res = await fetch(`/api/buckets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          alias: updatedBucket.name,
          bucket_name: updatedBucket.bucket,
          region: updatedBucket.region,
          root_folder: updatedBucket.folder,
          access_key_id: updatedBucket.accessKeyId,
          secret_access_key: updatedBucket.secretAccessKey,
          session_token: updatedBucket.sessionToken,
          max_upload_size: updatedBucket.maxUploadSize,
        }),
      });
      if (res.ok) {
        await refreshBuckets();
        recordBucketEvent('bucket.updated', id, {
          name: updatedBucket.name,
          bucket: updatedBucket.bucket,
          region: updatedBucket.region,
          previous_name: existing?.alias,
        });
      }
    })();
  };

  const deleteBucket = (id: string) => {
    const existing = rawRows.find(r => String(r.id) === id);
    (async () => {
      const res = await fetch(`/api/buckets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        if (selectedBucket?.id === id) setSelectedBucket(null);
        await refreshBuckets();
        if (existing) {
          recordBucketEvent('bucket.deleted', id, {
            name: existing.alias,
            bucket: existing.bucket_name,
            region: existing.region,
          });
        }
      }
    })();
  };

  const getBucketById = (id: string): BucketWithPermission | undefined =>
    userBuckets.find(b => b.id === id);

  const setBucketStatus = (id: string, status: Bucket['status']) =>
    setStatusMap(prev => ({ ...prev, [id]: status }));

  const canEditBucket = (bucketId: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return getBucketById(bucketId)?.isOwner ?? false;
  };

  const canDeleteBucket = (bucketId: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return getBucketById(bucketId)?.isOwner ?? false;
  };

  const canUploadToBucket = (bucketId: string): boolean => {
    if (!user) return false;
    return ['uploader', 'bucket-creator', 'admin'].includes(user.role ?? 'viewer');
  };

  // Drop selected bucket if it disappears from the user's list.
  useEffect(() => {
    if (selectedBucket && !userBuckets.some(b => b.id === selectedBucket.id)) {
      setSelectedBucket(null);
    }
  }, [userBuckets, selectedBucket]);

  return (
    <BucketContext.Provider value={{
      buckets: userBuckets,
      allBuckets,
      selectedBucket,
      addBucket,
      updateBucket,
      deleteBucket,
      setSelectedBucket,
      getBucketById,
      setBucketStatus,
      canEditBucket,
      canDeleteBucket,
      canUploadToBucket,
      refreshBuckets,
      isLoading,
      loadError,
    }}>
      {children}
    </BucketContext.Provider>
  );
}

export function useBucket() {
  const context = useContext(BucketContext);
  if (context === undefined) {
    throw new Error('useBucket must be used within a BucketProvider');
  }
  return context;
}
