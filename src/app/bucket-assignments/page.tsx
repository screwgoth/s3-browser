"use client";

import { useAuth } from '@/context/AuthContext';
import { useBucket } from '@/context/BucketContext';
import { useBucketAssignment } from '@/context/BucketAssignmentContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, UserPlus, Shield } from 'lucide-react';
import { writeAuditLog } from '@/actions/audit';
import { AppSidebar } from '@/components/app-sidebar';

type UserRole = 'viewer' | 'uploader' | 'bucket-creator' | 'admin';

interface ApiUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
}

const roleBadgeClass: Record<UserRole, string> = {
  viewer: 'bg-gray-100 text-gray-700',
  uploader: 'bg-blue-100 text-blue-700',
  'bucket-creator': 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
};
const roleLabels: Record<UserRole, string> = {
  viewer: 'Viewer',
  uploader: 'Uploader',
  'bucket-creator': 'Bucket Creator',
  admin: 'Admin',
};

export default function BucketAssignmentsPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const { allBuckets } = useBucket();
  const {
    getBucketAssignments,
    assignUserToBucket,
    removeUserFromBucket,
  } = useBucketAssignment();

  const [selectedBucketId, setSelectedBucketId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [apiUsers, setApiUsers] = useState<ApiUser[]>([]);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, isLoading, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setApiUsers(data.users);
      }
    } catch {
      // silently ignore — user list stays empty
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      fetchUsers();
    }
  }, [isLoading, isAdmin, fetchUsers]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isAdmin) return null;

  const nonAdminUsers = apiUsers.filter(u => u.role !== 'admin');

  const handleAssignUser = async () => {
    if (!selectedBucketId || !selectedUsername) return;
    // Assign with a neutral permission value — role governs actual access
    assignUserToBucket(selectedBucketId, selectedUsername, 'read-write');
    await writeAuditLog(
      user?.username ?? 'admin',
      'BUCKET_ASSIGN',
      `Assigned user "${selectedUsername}" to bucket "${allBuckets.find(b => b.id === selectedBucketId)?.name ?? selectedBucketId}"`
    );
    setSelectedUsername('');
  };

  const handleRemoveUser = async (bucketId: string, username: string) => {
    removeUserFromBucket(bucketId, username);
    await writeAuditLog(
      user?.username ?? 'admin',
      'BUCKET_UNASSIGN',
      `Removed user "${username}" from bucket "${allBuckets.find(b => b.id === bucketId)?.name ?? bucketId}"`
    );
  };

  return (
    <div className="min-h-screen skeu-bg">
    <AppSidebar title="Bucket Assignments" titleIcon={<Shield className="h-5 w-5" />} />
    <div className="container mx-auto p-6 max-w-6xl">

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Bucket User Assignments</CardTitle>
          <CardDescription>
            Assign users to buckets. Access level is determined by the user&apos;s role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Bucket</label>
              <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose bucket" />
                </SelectTrigger>
                <SelectContent>
                  {allBuckets.map(bucket => (
                    <SelectItem key={bucket.id} value={bucket.id}>
                      {bucket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Select User</label>
              <Select value={selectedUsername} onValueChange={setSelectedUsername}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose user" />
                </SelectTrigger>
                <SelectContent>
                  {nonAdminUsers.map(u => (
                    <SelectItem key={u.username} value={u.username}>
                      <span className="flex items-center gap-2">
                        {u.username}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadgeClass[u.role ?? 'viewer']}`}>
                          {roleLabels[u.role ?? 'viewer']}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleAssignUser}
                disabled={!selectedBucketId || !selectedUsername}
                className="w-full"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Current Assignments</h2>

        {allBuckets.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No buckets created yet. Create a bucket first to assign users.
              </p>
            </CardContent>
          </Card>
        ) : (
          allBuckets.map(bucket => {
            const assignments = getBucketAssignments(bucket.id);
            return (
              <Card key={bucket.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{bucket.name}</CardTitle>
                  <CardDescription>{bucket.bucket} • {bucket.region}</CardDescription>
                </CardHeader>
                <CardContent>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map(assignment => {
                        const assignedUser = apiUsers.find(u => u.username === assignment.username);
                        const role = assignedUser?.role ?? 'viewer';
                        return (
                          <div
                            key={`${assignment.bucketId}-${assignment.username}`}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{assignment.username}</span>
                              <Badge className={roleBadgeClass[role]}>
                                {roleLabels[role]}
                              </Badge>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveUser(bucket.id, assignment.username)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
    </div>
  );
}

