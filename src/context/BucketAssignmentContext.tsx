"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { recordBucketAssignment } from '@/actions/audit-record';

export type BucketPermission = 'read-only' | 'read-write';

export interface BucketAssignment {
  bucketId: string;
  username: string;
  permission: BucketPermission;
}

interface BucketAssignmentContextType {
  assignments: BucketAssignment[];
  assignUserToBucket: (bucketId: string, username: string, permission: BucketPermission) => void;
  removeUserFromBucket: (bucketId: string, username: string) => void;
  updateBucketPermission: (bucketId: string, username: string, permission: BucketPermission) => void;
  getBucketAssignments: (bucketId: string) => BucketAssignment[];
  getUserAssignments: (username: string) => BucketAssignment[];
  getUserBucketPermission: (bucketId: string, username: string) => BucketPermission | null;
}

const BucketAssignmentContext = createContext<BucketAssignmentContextType | undefined>(undefined);

export function BucketAssignmentProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<BucketAssignment[]>([]);

  const refreshAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/bucket-assignments', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAssignments(
          (data.assignments ?? []).map((a: any) => ({
            bucketId: String(a.bucket_id),
            username: a.username,
            permission: a.permission as BucketPermission,
          }))
        );
      }
      // 401/403 = non-admin session → leave assignments empty, no error needed
    } catch (e) {
      console.error('BucketAssignmentContext: failed to load assignments', e);
    }
  }, []);

  useEffect(() => { refreshAssignments(); }, [refreshAssignments]);

  const assignUserToBucket = (bucketId: string, username: string, permission: BucketPermission) => {
    (async () => {
      const res = await fetch('/api/bucket-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bucket_id: parseInt(bucketId, 10), username, permission }),
      });
      if (res.ok) {
        await refreshAssignments();
        await recordBucketAssignment(bucketId, bucketId, username, 'bucket.assigned');
        toast({ title: 'Assigned', description: `"${username}" assigned to bucket.`, duration: 2000 });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Error', description: data.error ?? 'Failed to assign user.' });
      }
    })();
  };

  const removeUserFromBucket = (bucketId: string, username: string) => {
    (async () => {
      const res = await fetch('/api/bucket-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bucket_id: parseInt(bucketId, 10), username }),
      });
      if (res.ok) {
        await refreshAssignments();
        await recordBucketAssignment(bucketId, bucketId, username, 'bucket.unassigned');
        toast({ title: 'Removed', description: `"${username}" removed from bucket.`, duration: 2000 });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove assignment.' });
      }
    })();
  };

  // updateBucketPermission is a reassign with a new permission value.
  const updateBucketPermission = (bucketId: string, username: string, permission: BucketPermission) => {
    assignUserToBucket(bucketId, username, permission);
  };

  const getBucketAssignments = (bucketId: string): BucketAssignment[] =>
    assignments.filter(a => a.bucketId === bucketId);

  const getUserAssignments = (username: string): BucketAssignment[] =>
    assignments.filter(a => a.username === username);

  const getUserBucketPermission = (bucketId: string, username: string): BucketPermission | null =>
    assignments.find(a => a.bucketId === bucketId && a.username === username)?.permission ?? null;

  return (
    <BucketAssignmentContext.Provider value={{
      assignments,
      assignUserToBucket,
      removeUserFromBucket,
      updateBucketPermission,
      getBucketAssignments,
      getUserAssignments,
      getUserBucketPermission,
    }}>
      {children}
    </BucketAssignmentContext.Provider>
  );
}

export function useBucketAssignment() {
  const context = useContext(BucketAssignmentContext);
  if (context === undefined) {
    throw new Error('useBucketAssignment must be used within a BucketAssignmentProvider');
  }
  return context;
}
