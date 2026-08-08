"use client";

import { useState, useEffect } from 'react';
import { useBucket, type BucketWithPermission } from '@/context/BucketContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash, Edit, HardDrive, Loader2, HelpCircle, CheckCircle, XCircle, RefreshCw, LayoutGrid, List, Shield, ShieldOff, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CredentialsForm, type S3Config } from '@/components/credentials-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import LoginPage from './login/page';
import { validateS3Connection } from '@/actions/s3';
import { useToast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/use-permission';
import { AppSidebar } from '@/components/app-sidebar';

type ViewType = 'card' | 'list';

export default function HomePage() {
  // Auth state comes from AuthContext — the single source of truth. Gating the
  // page on the SAME session resolution that drives BucketContext prevents the
  // "logged in but empty bucket list" race that a separate session check caused.
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const { canCreateBucket } = usePermission();
  const { buckets, addBucket, updateBucket, deleteBucket, setBucketStatus, canEditBucket, canDeleteBucket, isLoading: bucketsLoading, loadError, refreshBuckets } = useBucket();
  const router = useRouter();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<BucketWithPermission | undefined>(undefined);
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('card');

  // Redirect unauthenticated users once the session check has resolved.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // While the session is being restored, show a spinner.
  if (authLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Session resolved and there is no valid session — render login.
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleAddClick = () => {
    setEditingBucket(undefined);
    setIsFormOpen(true);
  };

  const handleEditClick = (bucket: BucketWithPermission) => {
    if (!canEditBucket(bucket.id)) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only the bucket owner can edit this configuration.",
      });
      return;
    }
    setEditingBucket(bucket);
    setIsFormOpen(true);
  };

  const handleSave = (config: S3Config) => {
    if (editingBucket) {
      updateBucket(editingBucket.id, { ...config, status: editingBucket.status });
    } else {
      addBucket({ ...config, status: 'untested' });
    }
    setIsFormOpen(false);
    setEditingBucket(undefined);
  };

  const handleSelectBucket = (bucket: BucketWithPermission) => {
    // Browse directly — the bucket view attempts the listing and surfaces any
    // connection error inline (with a retry), so no manual "test first" gate.
    router.push(`/buckets/${bucket.id}`);
  };

  const handleTestConnection = async (bucket: BucketWithPermission) => {
    setTestingConnectionId(bucket.id);
    const result = await validateS3Connection(bucket);
    if (result.success) {
      setBucketStatus(bucket.id, 'connected');
      toast({ title: 'Success', description: result.message, duration: 500 });
    } else {
      setBucketStatus(bucket.id, 'failed');
      toast({ variant: 'destructive', title: 'Connection Failed', description: result.message });
    }
    setTestingConnectionId(null);
  };

  const getStatusIcon = (status: BucketWithPermission['status']) => {
    switch (status) {
      case 'connected':
        return <Badge variant="outline" className="border-success/40 text-success"><CheckCircle className="mr-1 h-3 w-3" /> Connected</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      case 'untested':
      default:
        return <Badge variant="outline"><HelpCircle className="mr-1 h-3 w-3" /> Untested</Badge>;
    }
  };

  const BucketActions = ({ bucket }: { bucket: BucketWithPermission }) => (
    <div className="flex gap-2 justify-end">
       <Button 
          variant="secondary" 
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleTestConnection(bucket); }}
          disabled={testingConnectionId === bucket.id}
      >
          {testingConnectionId === bucket.id ? 
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
              <RefreshCw className="mr-2 h-4 w-4" />}
          Test
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={(e) => { e.stopPropagation(); handleEditClick(bucket); }}
        disabled={!canEditBucket(bucket.id)}
        aria-label={`Edit ${bucket.name}`}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-destructive hover:text-destructive h-9 w-9"
            onClick={(e) => e.stopPropagation()}
            disabled={!canDeleteBucket(bucket.id)}
            aria-label={`Delete ${bucket.name}`}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the &quot;{bucket.name}&quot; bucket configuration and
              removes it for every user it&apos;s shared with. Your S3 data is not affected.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteBucket(bucket.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="min-h-screen skeu-bg app-content">
      <AppSidebar />
      <main className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-semibold">Bucket List</h2>
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1 bg-muted p-1 rounded-lg'>
                <Button variant={view === 'card' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('card')} aria-label="Card view" aria-pressed={view === 'card'}><LayoutGrid/></Button>
                <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'}><List/></Button>
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              {canCreateBucket() && (
              <DialogTrigger asChild>
                <Button onClick={handleAddClick}><Plus className="mr-2 h-4 w-4" /> Add S3 Bucket</Button>
              </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingBucket ? 'Edit Bucket' : 'Add New S3 Bucket'}</DialogTitle>
                  <DialogDescription>{editingBucket ? 'Update the configuration for this bucket.' : 'Add a new S3-compatible bucket configuration.'}</DialogDescription>
                </DialogHeader>
                <CredentialsForm
                  onSave={handleSave}
                  onCancel={() => setIsFormOpen(false)}
                  initialData={editingBucket}
                  isEditing={!!editingBucket}
                  isAdmin={isAdmin}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {bucketsLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading buckets">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
                <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-9 w-full bg-muted rounded animate-pulse mt-4" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg flex flex-col items-center gap-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <h3 className="text-xl font-medium">Couldn&apos;t load your buckets</h3>
              <p className="text-muted-foreground">Something went wrong talking to the server.</p>
            </div>
            <Button variant="outline" onClick={() => refreshBuckets()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </div>
        ) : buckets.length > 0 ? (
          view === 'card' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {buckets.map((bucket) => (
                <Card key={bucket.id} className="flex flex-col cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleSelectBucket(bucket)}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {bucket.name}
                          {!bucket.isOwner && bucket.permission && (
                            <Badge variant={bucket.permission === 'read-write' ? 'default' : 'secondary'} className="text-xs">
                              {bucket.permission === 'read-write' ? (
                                <><Shield className="mr-1 h-3 w-3" /> R/W</>
                              ) : (
                                <><ShieldOff className="mr-1 h-3 w-3" /> R/O</>
                              )}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>s3://{bucket.bucket}</CardDescription>
                      </div>
                      {getStatusIcon(bucket.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">Region: {bucket.region}</p>
                    {!bucket.isOwner && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Shared by: {bucket.owner || 'admin'}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); handleSelectBucket(bucket); }}>Browse</Button>
                    <div className="flex gap-2">
                       <BucketActions bucket={bucket} />
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
             <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Bucket</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead>Permission</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {buckets.map(bucket => (
                            <TableRow key={bucket.id} onClick={() => handleSelectBucket(bucket)} className="cursor-pointer">
                                <TableCell className="font-medium">{bucket.name}</TableCell>
                                <TableCell>s3://{bucket.bucket}</TableCell>
                                <TableCell>{bucket.region}</TableCell>
                                <TableCell>
                                  {bucket.isOwner ? (
                                    <Badge variant="outline">Owner</Badge>
                                  ) : bucket.permission ? (
                                    <Badge variant={bucket.permission === 'read-write' ? 'default' : 'secondary'}>
                                      {bucket.permission === 'read-write' ? (
                                        <><Shield className="mr-1 h-3 w-3" /> Read & Write</>
                                      ) : (
                                        <><ShieldOff className="mr-1 h-3 w-3" /> Read Only</>
                                      )}
                                    </Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell>{getStatusIcon(bucket.status)}</TableCell>
                                <TableCell className="text-right">
                                    <BucketActions bucket={bucket} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </Card>
          )
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            {canCreateBucket() ? (
              <>
                <h3 className="text-xl font-medium">No buckets yet</h3>
                <p className="text-muted-foreground mb-4">Add your first S3 bucket to get started.</p>
                <Button onClick={handleAddClick}><Plus className="mr-2 h-4 w-4" /> Add S3 Bucket</Button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-medium">No buckets shared with you yet</h3>
                <p className="text-muted-foreground">Ask an administrator to assign a bucket to your account.</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
