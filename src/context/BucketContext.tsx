
"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface Bucket {
  id: string;
  name: string;
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  status: 'untested' | 'connected' | 'failed';
  owner?: string;
  folder?: string;
}

interface BucketContextType {
  buckets: Bucket[];
  selectedBucket: Bucket | null;
  addBucket: (bucket: Omit<Bucket, 'id'>) => void;
  updateBucket: (id: string, bucket: Omit<Bucket, 'id'>) => void;
  deleteBucket: (id: string) => void;
  setSelectedBucket: (bucket: Bucket | null) => void;
  getBucketById: (id: string) => Bucket | undefined;
  setBucketStatus: (id: string, status: Bucket['status']) => void;
}

const BucketContext = createContext<BucketContextType | undefined>(undefined);

export function BucketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [allBuckets, setAllBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Safe access to localStorage
        const storage = window.localStorage;
        if (storage && typeof storage.getItem === 'function') {
          const storedBuckets = storage.getItem('s3-buckets');
          if (storedBuckets) {
            setAllBuckets(JSON.parse(storedBuckets));
          }
        }
      } catch (e) {
        console.error("Failed to load buckets from localStorage", e);
        setAllBuckets([]);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      try {
        const storage = window.localStorage;
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem('s3-buckets', JSON.stringify(allBuckets));
        }
      } catch (e) {
        console.error("Failed to save buckets to localStorage", e);
      }
    }
  }, [allBuckets, isLoaded]);

  const userBuckets = React.useMemo(() => {
    if (!user) return [];
    return allBuckets.filter(b => {
      if (b.owner) return b.owner === user.username;
      // Default to admin visibility for legacy buckets (buckets with no owner)
      // Adjust this logic if you want strict isolation
      if (!b.owner && user.username === 'admin') return true;
      return false;
    });
  }, [allBuckets, user]);

  const addBucket = (bucket: Omit<Bucket, 'id'>) => {
    if (!user) return; // Should not happen if guarded
    const newBucket: Bucket = {
      ...bucket,
      id: crypto.randomUUID(),
      owner: user.username
    };
    setAllBuckets(prev => [...prev, newBucket]);
  };

  const updateBucket = (id: string, updatedBucket: Omit<Bucket, 'id'>) => {
    setAllBuckets(prev => prev.map(b => b.id === id ? { ...updatedBucket, id, owner: b.owner } : b));
  };

  const deleteBucket = (id: string) => {
    setAllBuckets(prev => prev.filter(b => b.id !== id));
    if (selectedBucket?.id === id) {
      setSelectedBucket(null);
    }
  };

  const getBucketById = (id: string) => {
    // We search in allBuckets, but technically we should restrict to userBuckets?
    // But update/delete operations need to find it. 
    // And getBucketById is likely used for display. 
    // Let's return from userBuckets to be safe.
    return userBuckets.find(b => b.id === id);
  };

  const setBucketStatus = (id: string, status: Bucket['status']) => {
    setAllBuckets(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  // Deselect if the current bucket is no longer in the user's list
  useEffect(() => {
    if (selectedBucket && !userBuckets.some(b => b.id === selectedBucket.id)) {
      setSelectedBucket(null);
    }
  }, [userBuckets, selectedBucket]);

  return (
    <BucketContext.Provider value={{ buckets: userBuckets, selectedBucket, addBucket, updateBucket, deleteBucket, setSelectedBucket, getBucketById, setBucketStatus }}>
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
