"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useBucketAssignment, type BucketPermission } from './BucketAssignmentContext';

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
}

export interface BucketWithPermission extends Bucket {
  permission?: BucketPermission; // Permission for current user (if assigned)
  isOwner: boolean; // True if current user is the owner
}

interface BucketContextType {
  buckets: BucketWithPermission[];
  allBuckets: Bucket[]; // For admin to see all buckets
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
}

const BucketContext = createContext<BucketContextType | undefined>(undefined);

export function BucketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getUserAssignments, getUserBucketPermission } = useBucketAssignment();
  const [allBucketsData, setAllBucketsData] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<BucketWithPermission | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          const storedBuckets = storage.getItem('s3-buckets');
          if (storedBuckets) {
            setAllBucketsData(JSON.parse(storedBuckets));
          }
        }
      } catch (e) {
        console.error("Failed to load buckets from localStorage", e);
        setAllBucketsData([]);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem('s3-buckets', JSON.stringify(allBucketsData));
        }
      } catch (e) {
        console.error("Failed to save buckets to localStorage", e);
      }
    }
  }, [allBucketsData, isLoaded]);

  // Calculate user-visible buckets with permissions
  const userBuckets: BucketWithPermission[] = React.useMemo(() => {
    if (!user) return [];

    const isAdmin = user.role === 'admin';
    const userAssignments = getUserAssignments(user.username);
    const assignedBucketIds = new Set(userAssignments.map(a => a.bucketId));

    return allBucketsData
      .filter(b => {
        // Admins see every bucket
        if (isAdmin) return true;
        // Users see buckets they own
        if (b.owner === user.username) return true;
        // Users see buckets assigned to them
        if (assignedBucketIds.has(b.id)) return true;
        return false;
      })
      .map(b => ({
        ...b,
        isOwner: b.owner === user.username,
        permission: getUserBucketPermission(b.id, user.username) || undefined
      }));
  }, [allBucketsData, user, getUserAssignments, getUserBucketPermission]);

  const addBucket = (bucket: Omit<Bucket, 'id'>) => {
    if (!user) return;
    // Only bucket-creator and admin can create buckets
    if (!['bucket-creator', 'admin'].includes(user.role ?? '')) {
      console.warn('User does not have permission to create buckets');
      return;
    }
    const newBucket: Bucket = {
      ...bucket,
      id: crypto.randomUUID(),
      owner: user.username
    };
    setAllBucketsData(prev => [...prev, newBucket]);
    import('@/actions/audit').then(({ writeAuditLog }) =>
      writeAuditLog(user.username, 'BUCKET_CREATE', `Created bucket "${bucket.name}" (${bucket.bucket}) in ${bucket.region}`)
    );
  };

  const updateBucket = (id: string, updatedBucket: Omit<Bucket, 'id'>) => {
    const existing = allBucketsData.find(b => b.id === id);
    setAllBucketsData(prev => prev.map(b =>
      b.id === id ? { ...updatedBucket, id, owner: b.owner } : b
    ));
    if (user && existing) {
      import('@/actions/audit').then(({ writeAuditLog }) =>
        writeAuditLog(user.username, 'BUCKET_UPDATE', `Updated bucket "${existing.name}" (${id})`)
      );
    }
  };

  const deleteBucket = (id: string) => {
    const existing = allBucketsData.find(b => b.id === id);
    setAllBucketsData(prev => prev.filter(b => b.id !== id));
    if (selectedBucket?.id === id) {
      setSelectedBucket(null);
    }
    if (user && existing) {
      import('@/actions/audit').then(({ writeAuditLog }) =>
        writeAuditLog(user.username, 'BUCKET_DELETE', `Deleted bucket "${existing.name}" (${existing.bucket})`)
      );
    }
  };

  const getBucketById = (id: string): BucketWithPermission | undefined => {
    return userBuckets.find(b => b.id === id);
  };

  const setBucketStatus = (id: string, status: Bucket['status']) => {
    setAllBucketsData(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  const canEditBucket = (bucketId: string): boolean => {
    if (!user) return false;
    const bucket = getBucketById(bucketId);
    if (!bucket) return false;
    // Only owner can edit
    return bucket.isOwner;
  };

  const canDeleteBucket = (bucketId: string): boolean => {
    if (!user) return false;
    const bucket = getBucketById(bucketId);
    if (!bucket) return false;
    // Only owner can delete
    return bucket.isOwner;
  };

  const canUploadToBucket = (bucketId: string): boolean => {
    if (!user) return false;
    const bucket = getBucketById(bucketId);
    if (!bucket) return false;
    // Role always wins — viewer can never upload
    const role = user.role ?? 'viewer';
    return ['uploader', 'bucket-creator', 'admin'].includes(role);
  };

  // Deselect if the current bucket is no longer in the user's list
  useEffect(() => {
    if (selectedBucket && !userBuckets.some(b => b.id === selectedBucket.id)) {
      setSelectedBucket(null);
    }
  }, [userBuckets, selectedBucket]);

  return (
    <BucketContext.Provider value={{ 
      buckets: userBuckets,
      allBuckets: allBucketsData,
      selectedBucket,
      addBucket,
      updateBucket,
      deleteBucket,
      setSelectedBucket,
      getBucketById,
      setBucketStatus,
      canEditBucket,
      canDeleteBucket,
      canUploadToBucket
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
