"use client";

import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';

export default function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const { updateUser } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);

    // Validate current password
    if (currentPassword !== user.password) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Current password is incorrect.',
      });
      setIsChangingPassword(false);
      return;
    }

    // Validate new password
    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'New password must be at least 6 characters long.',
      });
      setIsChangingPassword(false);
      return;
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'New passwords do not match.',
      });
      setIsChangingPassword(false);
      return;
    }

    // Update password
    updateUser(user.username, newPassword);

    // Clear form
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);

    toast({
      title: 'Success',
      description: 'Password updated successfully.',
      duration: 500,
    });
  };

  return (
    <div className="min-h-screen skeu-bg">
      <AppSidebar title="Profile" titleIcon={<UserIcon className="h-5 w-5" />} />

      <main className="container mx-auto p-6 max-w-2xl">
        <div className="space-y-6">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Username</Label>
                <div className="mt-1 p-3 bg-muted rounded-md font-medium">
                  {user.username}
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <div className="mt-1 p-3 bg-muted rounded-md font-medium">
                  {user.username === 'admin' ? 'Administrator' : 'User'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter new password"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum 6 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
              >
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
