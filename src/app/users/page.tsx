
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, Loader2, Users, Key, ShieldCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AppSidebar } from '@/components/app-sidebar';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'viewer' | 'uploader' | 'bucket-creator' | 'admin';

interface ApiUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
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

const addUserSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  role: z.enum(['viewer', 'uploader', 'bucket-creator', 'admin'] as const).default('viewer'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

type AddUserValues = z.infer<typeof addUserSchema>;
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const AddUserForm = ({ onSave, onCancel }: { onSave: (values: AddUserValues) => void; onCancel: () => void }) => {
  const form = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { username: '', password: '', role: 'viewer' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="newuser" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">Min 8 chars, uppercase, lowercase, and number required</p>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="uploader">Uploader</SelectItem>
                  <SelectItem value="bucket-creator">Bucket Creator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Add User</Button>
        </div>
      </form>
    </Form>
  );
};

const ResetPasswordForm = ({ username, onSave, onCancel }: { username: string; onSave: (values: ResetPasswordValues) => void; onCancel: () => void }) => {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password for {username}</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground">Min 8 chars, uppercase, lowercase, and number required. User will be required to change on next login.</p>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Reset Password</Button>
        </div>
      </form>
    </Form>
  );
};

export default function UserManagementPage() {
  const { isAuthenticated, isAdmin, isLoading: isAuthLoading } = useAuth();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<ApiUser | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole>('viewer');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<ApiUser | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load users.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load users.' });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!isAuthenticated || !isAdmin) {
        router.push('/');
      } else {
        fetchUsers();
      }
    }
  }, [isAdmin, isAuthenticated, isAuthLoading, router, fetchUsers]);

  if (isAuthLoading || !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleAddUser = async (values: AddUserValues) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Success', description: `User "${values.username}" added.`, duration: 1500 });
        setIsAddFormOpen(false);
        fetchUsers();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to create user.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred.' });
    }
  };

  const handleResetPassword = async (values: ResetPasswordValues) => {
    if (!resetPasswordUser) return;

    try {
      const response = await fetch(`/api/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: values.password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Success', description: `Password reset for "${resetPasswordUser.username}". User must change on next login.`, duration: 2000 });
        setResetPasswordUser(null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to reset password.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred.' });
    }
  };

  const handleRoleChange = async () => {
    if (!roleDialogUser) return;

    try {
      const response = await fetch(`/api/users/${roleDialogUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: pendingRole }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Success', description: `Role for "${roleDialogUser.username}" updated to ${roleLabels[pendingRole]}.`, duration: 1500 });
        setRoleDialogUser(null);
        fetchUsers();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to update role.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred.' });
    }
  };

  const handleDeleteUser = async (user: ApiUser) => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: 'Success', description: `User "${user.username}" deleted.`, duration: 1500 });
        fetchUsers();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to delete user.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred.' });
    }
  };

  return (
    <div className="min-h-screen skeu-bg">
      <AppSidebar title="User Management" titleIcon={<Users className="h-5 w-5" />} />
      <main className="p-4 md:p-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2"><Users /> User Management</CardTitle>
              <CardDescription>Add, edit, or remove users.</CardDescription>
            </div>
            <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAddFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>Create a new user account and assign a role.</DialogDescription>
                </DialogHeader>
                <AddUserForm onSave={handleAddUser} onCancel={() => setIsAddFormOpen(false)} />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>
                        <Badge className={roleBadgeClass[u.role ?? 'viewer']}>
                          {roleLabels[u.role ?? 'viewer']}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.must_change_password && (
                          <Badge variant="outline" className="text-amber-600 border-amber-400">Must change password</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setResetPasswordUser(u)}
                            title="Reset Password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {u.username !== 'admin' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Change Role"
                                onClick={() => { setRoleDialogUser(u); setPendingRole(u.role ?? 'viewer'); }}
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the user "{u.username}". This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) setResetPasswordUser(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password — {resetPasswordUser?.username}</DialogTitle>
            <DialogDescription>Set a new temporary password. The user will be required to change it on next login.</DialogDescription>
          </DialogHeader>
          {resetPasswordUser && (
            <ResetPasswordForm
              username={resetPasswordUser.username}
              onSave={handleResetPassword}
              onCancel={() => setResetPasswordUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => { if (!open) setRoleDialogUser(null); }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialogUser?.username}</DialogTitle>
            <DialogDescription>Select a new role for this user. Changes take effect immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={pendingRole} onValueChange={(v) => setPendingRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="uploader">Uploader</SelectItem>
                <SelectItem value="bucket-creator">Bucket Creator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoleDialogUser(null)}>Cancel</Button>
              <Button onClick={handleRoleChange}>Save Role</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
