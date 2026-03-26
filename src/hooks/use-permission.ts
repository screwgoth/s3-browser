import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/context/UserContext';

export function usePermission() {
  const { user, isAdmin, role } = useAuth();
  const userRole: UserRole = role ?? 'viewer';

  return {
    canUpload: () => ['uploader', 'bucket-creator', 'admin'].includes(userRole),
    canCreateBucket: () => ['bucket-creator', 'admin'].includes(userRole),
    canManageUsers: () => userRole === 'admin',
    canDownload: () => true,
    role: userRole,
    isAdmin: isAdmin ?? false,
  };
}
