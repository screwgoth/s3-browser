"use client";

import { useAuth } from '@/context/AuthContext';
import { useBucket } from '@/context/BucketContext';
import { useBucketAssignment } from '@/context/BucketAssignmentContext';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Shield, ShieldOff } from 'lucide-react';

export default function BucketAssignmentsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { allBuckets } = useBucket();
  const { users } = useUser();
  const { 
    getBucketAssignments, 
    assignUserToBucket, 
    removeUserFromBucket,
    updateBucketPermission 
  } = useBucketAssignment();

  const [selectedBucketId, setSelectedBucketId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'read-only' | 'read-write'>('read-only');

  useEffect(() => {
    if (!isLoading && (!user || user.username !== 'admin')) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user || user.username !== 'admin') {
    return null;
  }

  const adminBuckets = allBuckets.filter(b => b.owner === 'admin');
  const nonAdminUsers = users.filter(u => u.username !== 'admin');

  const handleAssignUser = () => {
    if (!selectedBucketId || !selectedUsername) return;
    assignUserToBucket(selectedBucketId, selectedUsername, selectedPermission);
    setSelectedUsername('');
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Button onClick={() => router.push('/')} variant="outline">
          ← Back to Buckets
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Bucket User Assignments</CardTitle>
          <CardDescription>
            Assign users to your buckets and set their permissions (read-only or read-write)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Bucket</label>
                <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminBuckets.map(bucket => (
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
                    {nonAdminUsers.map(user => (
                      <SelectItem key={user.username} value={user.username}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Permission</label>
                <Select value={selectedPermission} onValueChange={(val: any) => setSelectedPermission(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read-only">Read Only</SelectItem>
                    <SelectItem value="read-write">Read & Write</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Current Assignments</h2>
        
        {adminBuckets.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No buckets created yet. Create a bucket first to assign users.
              </p>
            </CardContent>
          </Card>
        ) : (
          adminBuckets.map(bucket => {
            const assignments = getBucketAssignments(bucket.id);
            
            return (
              <Card key={bucket.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{bucket.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {bucket.bucket} • {bucket.region}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No users assigned to this bucket yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map(assignment => (
                        <div 
                          key={`${assignment.bucketId}-${assignment.username}`}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{assignment.username}</span>
                            <Badge variant={assignment.permission === 'read-write' ? 'default' : 'secondary'}>
                              {assignment.permission === 'read-write' ? (
                                <><Shield className="mr-1 h-3 w-3" /> Read & Write</>
                              ) : (
                                <><ShieldOff className="mr-1 h-3 w-3" /> Read Only</>
                              )}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Select
                              value={assignment.permission}
                              onValueChange={(val: any) => 
                                updateBucketPermission(bucket.id, assignment.username, val)
                              }
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="read-only">Read Only</SelectItem>
                                <SelectItem value="read-write">Read & Write</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeUserFromBucket(bucket.id, assignment.username)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
