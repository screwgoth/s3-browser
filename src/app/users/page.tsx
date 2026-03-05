
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUser, type User } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash, Edit, LogOut, HardDrive, Loader2, Users, Key } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from 'next/link';

const userFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

const UserForm = ({ onSave, onCancel, initialData }: { onSave: (values: UserFormValues) => void; onCancel: () => void; initialData?: User }) => {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: initialData || { username: "", password: "" },
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
        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">{initialData ? 'Update Password' : 'Add User'}</Button>
        </div>
      </form>
    </Form>
  );
};


export default function UserManagementPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const { users, addUser, updateUser, deleteUser } = useUser();
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    if (!isAuthLoading) {
        if (!isAuthenticated || user?.username !== 'admin') {
            router.push('/');
        }
    }
  }, [user, isAuthenticated, isAuthLoading, router]);


  if (isAuthLoading || user?.username !== 'admin') {
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
      addUser(values.username, values.password);
    }
    setIsFormOpen(false);
    setEditingUser(undefined);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background">
       <header className="p-4 border-b flex justify-between items-center">
        <h1 className="text-2xl font-headline flex items-center gap-2"><Link href="/" passHref><Button variant="ghost" className="text-2xl"><HardDrive/> S3 Navigator</Button></Link></h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
        </div>
      </header>
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
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map(u => (
                        <TableRow key={u.username}>
                            <TableCell className="font-medium">{u.username}{u.username === 'admin' && ' (Admin)'}</TableCell>
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
    </div>
  );
}
