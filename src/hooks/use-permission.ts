import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/context/UserContext';

export function usePermission() {
  const { user, isAdmin, role, isLoading } = useAuth();
  const userRole: UserRole = (role as UserRole) ?? 'viewer';

  return {
    canUpload: () => !isLoading && ['uploader', 'bucket-creator', 'admin'].includes(userRole),
    canCreateBucket: () => !isLoading && ['bucket-creator', 'admin'].includes(userRole),
    canManageUsers: () => !isLoading && userRole === 'admin',
    canDownload: () => true,
    role: userRole,
    isAdmin: isAdmin ?? false,
    isLoading,
  };
}
