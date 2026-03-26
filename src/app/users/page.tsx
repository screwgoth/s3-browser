
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUser, type User, type UserRole } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, Loader2, Users, Key, ShieldCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AppSidebar } from '@/components/app-sidebar';

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

const userFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(['viewer', 'uploader', 'bucket-creator', 'admin'] as const).default('viewer'),
});

type UserFormValues = z.infer<typeof userFormSchema>;

const UserForm = ({ onSave, onCancel, initialData }: { onSave: (values: UserFormValues) => void; onCancel: () => void; initialData?: User }) => {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: initialData ? { username: initialData.username, password: '', role: initialData.role ?? 'viewer' } : { username: '', password: '', role: 'viewer' },
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
                <Input placeholder="newuser" {...field} disabled={!!initialData} />
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
            </FormItem>
          )}
        />
        {!initialData && (
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
        )}
        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">{initialData ? 'Update Password' : 'Add User'}</Button>
        </div>
      </form>
    </Form>
  );
};


export default function UserManagementPage() {
  const { user, isAuthenticated, isAdmin, isLoading: isAuthLoading } = useAuth();
  const { users, addUser, updateUser, updateUserRole, deleteUser } = useUser();
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole>('viewer');
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    if (!isAuthLoading) {
        if (!isAuthenticated || !isAdmin) {
            router.push('/');
        }
    }
  }, [isAdmin, isAuthenticated, isAuthLoading, router]);


  if (isAuthLoading || !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleAddClick = () => {
    setEditingUser(undefined);
    setIsFormOpen(true);
  };

  const handleEditClick = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setIsFormOpen(true);
  };

  const handleSave = (values: UserFormValues) => {
    if (editingUser) {
      updateUser(editingUser.username, values.password);
    } else {
      addUser(values.username, values.password, values.role);
    }
    setIsFormOpen(false);
    setEditingUser(undefined);
  };

  const handleRoleChange = () => {
    if (roleDialogUser) {
      updateUserRole(roleDialogUser.username, pendingRole);
      setRoleDialogUser(null);
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
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddClick}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingUser ? `Reset Password for ${editingUser.username}` : 'Add New User'}</DialogTitle>
              </DialogHeader>
              <UserForm 
                onSave={handleSave} 
                onCancel={() => setIsFormOpen(false)}
                initialData={editingUser}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map(u => (
                        <TableRow key={u.username}>
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>
                                <Badge className={roleBadgeClass[u.role ?? 'viewer']}>
                                  {roleLabels[u.role ?? 'viewer']}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleEditClick(u)}
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
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash className="h-4 w-4" /></Button>
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
                                                <AlertDialogAction onClick={() => deleteUser(u.username)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
        </CardContent>
      </Card>
      </main>

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => { if (!open) setRoleDialogUser(null); }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialogUser?.username}</DialogTitle>
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
