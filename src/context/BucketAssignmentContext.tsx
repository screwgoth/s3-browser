"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

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
  const [isLoaded, setIsLoaded] = useState(false);

  // Load assignments from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          const storedAssignments = storage.getItem('s3-bucket-assignments');
          if (storedAssignments) {
            setAssignments(JSON.parse(storedAssignments));
          }
        }
      } catch (e) {
        console.error("Failed to load bucket assignments from localStorage", e);
        setAssignments([]);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save assignments to localStorage
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem('s3-bucket-assignments', JSON.stringify(assignments));
        }
      } catch (e) {
        console.error("Failed to save bucket assignments to localStorage", e);
      }
    }
  }, [assignments, isLoaded]);

  const assignUserToBucket = (bucketId: string, username: string, permission: BucketPermission) => {
    // Check if assignment already exists
    const existingIndex = assignments.findIndex(
      a => a.bucketId === bucketId && a.username === username
    );

    if (existingIndex !== -1) {
      // Update existing assignment
      setAssignments(prev => prev.map((a, i) => 
        i === existingIndex ? { ...a, permission } : a
      ));
      toast({ 
        title: 'Updated', 
        description: `Permission for "${username}" updated to ${permission}.`,
        duration: 500
      });
    } else {
      // Add new assignment
      setAssignments(prev => [...prev, { bucketId, username, permission }]);
      toast({ 
        title: 'Assigned', 
        description: `User "${username}" assigned to bucket with ${permission} permission.`,
        duration: 500
      });
    }
  };

  const removeUserFromBucket = (bucketId: string, username: string) => {
    setAssignments(prev => prev.filter(
      a => !(a.bucketId === bucketId && a.username === username)
    ));
    toast({ 
      title: 'Removed', 
      description: `User "${username}" removed from bucket.`,
      duration: 500
    });
  };

  const updateBucketPermission = (bucketId: string, username: string, permission: BucketPermission) => {
    setAssignments(prev => prev.map(a => 
      a.bucketId === bucketId && a.username === username 
        ? { ...a, permission } 
        : a
    ));
    toast({ 
      title: 'Updated', 
      description: `Permission updated to ${permission}.`,
      duration: 500
    });
  };

  const getBucketAssignments = (bucketId: string): BucketAssignment[] => {
    return assignments.filter(a => a.bucketId === bucketId);
  };

  const getUserAssignments = (username: string): BucketAssignment[] => {
    return assignments.filter(a => a.username === username);
  };

  const getUserBucketPermission = (bucketId: string, username: string): BucketPermission | null => {
    const assignment = assignments.find(
      a => a.bucketId === bucketId && a.username === username
    );
    return assignment ? assignment.permission : null;
  };

  return (
    <BucketAssignmentContext.Provider value={{
      assignments,
      assignUserToBucket,
      removeUserFromBucket,
      updateBucketPermission,
      getBucketAssignments,
      getUserAssignments,
      getUserBucketPermission
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
