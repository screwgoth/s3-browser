"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';

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
  status?: 'untested' | 'connected' | 'failed';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface BucketContextType {
  buckets: Bucket[];
  selectedBucket: Bucket | null;
  loading: boolean;
  error: string | null;
  addBucket: (bucket: {
    alias: string;
    bucket_name: string;
    region: string;
    root_folder?: string;
    access_key_id?: string;
    secret_access_key?: string;
    session_token?: string;
  }) => Promise<boolean>;
  updateBucket: (id: number, updates: Partial<Bucket>) => Promise<boolean>;
  deleteBucket: (id: number) => Promise<boolean>;
  refreshBuckets: () => Promise<void>;
  setSelectedBucket: (bucket: Bucket | null) => void;
  getBucketById: (id: number) => Bucket | undefined;
  setBucketStatus: (id: number, status: 'untested' | 'connected' | 'failed') => void;
}

const BucketContext = createContext<BucketContextType | undefined>(undefined);

export function BucketProvider({ children }: { children: React.ReactNode }) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load buckets from database
  const refreshBuckets = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/buckets');
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - clear buckets
          setBuckets([]);
          return;
        }
        throw new Error('Failed to load buckets');
      }

      const data = await response.json();
      setBuckets(data.buckets || []);
    } catch (err) {
      console.error('Error loading buckets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load buckets');
    } finally {
      setLoading(false);
    }
  };

  // Load buckets on mount
  useEffect(() => {
    refreshBuckets();
  }, []);

  // Add a new bucket
  const addBucket = async (bucket: {
    alias: string;
    bucket_name: string;
    region: string;
    root_folder?: string;
    access_key_id?: string;
    secret_access_key?: string;
    session_token?: string;
  }): Promise<boolean> => {
    try {
      setError(null);

      const response = await fetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bucket),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add bucket');
      }

      // Refresh bucket list
      await refreshBuckets();
      return true;
    } catch (err) {
      console.error('Error adding bucket:', err);
      setError(err instanceof Error ? err.message : 'Failed to add bucket');
      return false;
    }
  };

  // Update an existing bucket
  const updateBucket = async (id: number, updates: Partial<Bucket>): Promise<boolean> => {
    try {
      setError(null);

      const response = await fetch(`/api/buckets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update bucket');
      }

      // Refresh bucket list
      await refreshBuckets();
      return true;
    } catch (err) {
      console.error('Error updating bucket:', err);
      setError(err instanceof Error ? err.message : 'Failed to update bucket');
      return false;
    }
  };

  // Delete a bucket
  const deleteBucket = async (id: number): Promise<boolean> => {
    try {
      setError(null);

      const response = await fetch(`/api/buckets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete bucket');
      }

      // Clear selected bucket if it was deleted
      if (selectedBucket?.id === id) {
        setSelectedBucket(null);
      }

      // Refresh bucket list
      await refreshBuckets();
      return true;
    } catch (err) {
      console.error('Error deleting bucket:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete bucket');
      return false;
    }
  };

  // Get bucket by ID
  const getBucketById = (id: number): Bucket | undefined => {
    return buckets.find(b => b.id === id);
  };

  // Set bucket status (client-side only, not persisted)
  const setBucketStatus = (id: number, status: 'untested' | 'connected' | 'failed') => {
    setBuckets(prev => prev.map(b => 
      b.id === id ? { ...b, status } : b
    ));
  };

  const value: BucketContextType = {
    buckets,
    selectedBucket,
    loading,
    error,
    addBucket,
    updateBucket,
    deleteBucket,
    refreshBuckets,
    setSelectedBucket,
    getBucketById,
    setBucketStatus,
  };

  return <BucketContext.Provider value={value}>{children}</BucketContext.Provider>;
}

export function useBuckets() {
  const context = useContext(BucketContext);
  if (context === undefined) {
    throw new Error('useBuckets must be used within a BucketProvider');
  }
  return context;
}
