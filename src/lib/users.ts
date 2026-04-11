/**
 * User management utilities
 */

import { query, transaction } from './db';
import { hashPassword } from './auth';
import { createAuditLog } from './audit';
import type { User } from './auth';

export interface CreateUserInput {
  username: string;
  password: string;
  role: 'viewer' | 'uploader' | 'bucket-creator' | 'admin';
  createdBy?: number;
  createdByUsername?: string;
}

export interface UpdateUserInput {
  role?: 'viewer' | 'uploader' | 'bucket-creator' | 'admin';
  is_active?: boolean;
  updatedBy?: number;
  updatedByUsername?: string;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
  const result = await query<User>(
    'SELECT id, username, role, is_active, must_change_password, last_password_change, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  return result.rows;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<User | null> {
  const result = await query<User>(
    'SELECT id, username, role, is_active, must_change_password, last_password_change, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT id, username, role, is_active, must_change_password, last_password_change, created_at, updated_at FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User | null> {
  try {
    // Check if username already exists
    const existing = await getUserByUsername(input.username);
    if (existing) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    return await transaction(async (client) => {
      // Create user with must_change_password = true (first login)
      const result = await client.query<User>(
        `INSERT INTO users (username, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, true)
         RETURNING id, username, role, is_active, must_change_password, last_password_change, created_at, updated_at`,
        [input.username, passwordHash, input.role]
      );

      const user = result.rows[0];

      // Audit log
      await createAuditLog({
        user_id: input.createdBy,
        username: input.createdByUsername,
        action: 'user.created',
        resource_type: 'user',
        resource_id: user.id.toString(),
        details: {
          target_username: user.username,
          target_role: user.role,
        },
        status: 'success',
      });

      return user;
    });
  } catch (error) {
    console.error('Create user error:', error);
    return null;
  }
}

/**
 * Update a user
 */
export async function updateUser(
  id: number,
  input: UpdateUserInput
): Promise<User | null> {
  try {
    return await transaction(async (client) => {
      const user = await getUserById(id);
      if (!user) {
        throw new Error('User not found');
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.role !== undefined) {
        updates.push(`role = $${paramIndex++}`);
        params.push(input.role);
      }

      if (input.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(input.is_active);
      }

      if (updates.length === 0) {
        return user; // No updates
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await client.query<User>(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} 
         RETURNING id, username, role, is_active, must_change_password, last_password_change, created_at, updated_at`,
        params
      );

      const updatedUser = result.rows[0];

      // Audit log
      await createAuditLog({
        user_id: input.updatedBy,
        username: input.updatedByUsername,
        action: 'user.updated',
        resource_type: 'user',
        resource_id: id.toString(),
        details: {
          target_username: updatedUser.username,
          changes: input,
        },
        status: 'success',
      });

      return updatedUser;
    });
  } catch (error) {
    console.error('Update user error:', error);
    return null;
  }
}

/**
 * Delete a user
 */
export async function deleteUser(
  id: number,
  deletedBy?: number,
  deletedByUsername?: string
): Promise<boolean> {
  try {
    return await transaction(async (client) => {
      const user = await getUserById(id);
      if (!user) {
        return false;
      }

      // Don't allow deleting the last admin
      if (user.role === 'admin') {
        const adminCount = await client.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = true"
        );
        if (parseInt(adminCount.rows[0].count, 10) <= 1) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      await client.query('DELETE FROM users WHERE id = $1', [id]);

      // Audit log
      await createAuditLog({
        user_id: deletedBy,
        username: deletedByUsername,
        action: 'user.deleted',
        resource_type: 'user',
        resource_id: id.toString(),
        details: {
          target_username: user.username,
          target_role: user.role,
        },
        status: 'success',
      });

      return true;
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return false;
  }
}

/**
 * Toggle user active status
 */
export async function toggleUserStatus(
  id: number,
  updatedBy?: number,
  updatedByUsername?: string
): Promise<User | null> {
  try {
    return await transaction(async (client) => {
      const user = await getUserById(id);
      if (!user) {
        return null;
      }

      // Don't allow deactivating the last admin
      if (user.role === 'admin' && user.is_active) {
        const activeAdminCount = await client.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = true"
        );
        if (parseInt(activeAdminCount.rows[0].count, 10) <= 1) {
          throw new Error('Cannot deactivate the last admin user');
        }
      }

      const result = await client.query<User>(
        `UPDATE users 
         SET is_active = NOT is_active, updated_at = NOW() 
         WHERE id = $1 
         RETURNING id, username, role, is_active, must_change_password, last_password_change, created_at, updated_at`,
        [id]
      );

      const updatedUser = result.rows[0];

      // Audit log
      await createAuditLog({
        user_id: updatedBy,
        username: updatedByUsername,
        action: updatedUser.is_active ? 'user.activated' : 'user.deactivated',
        resource_type: 'user',
        resource_id: id.toString(),
        details: {
          target_username: updatedUser.username,
        },
        status: 'success',
      });

      return updatedUser;
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    return null;
  }
}

/**
 * Reset a user's password (admin action) — sets must_change_password = true
 */
export async function resetUserPassword(
  id: number,
  newPassword: string,
  resetBy?: number,
  resetByUsername?: string
): Promise<boolean> {
  try {
    const passwordHash = await hashPassword(newPassword);

    return await transaction(async (client) => {
      const result = await client.query<User>(
        `UPDATE users
         SET password_hash = $1,
             must_change_password = true,
             last_password_change = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, username`,
        [passwordHash, id]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const user = result.rows[0];

      // Invalidate all sessions for this user
      await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);

      await createAuditLog({
        user_id: resetBy,
        username: resetByUsername,
        action: 'password.admin_reset',
        resource_type: 'user',
        resource_id: id.toString(),
        details: { target_username: user.username },
        status: 'success',
      });

      return true;
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    return false;
  }
}

/**
 * Get user count by role
 */
export async function getUserCountByRole(): Promise<Record<string, number>> {
  const result = await query<{ role: string; count: string }>(
    'SELECT role, COUNT(*) as count FROM users WHERE is_active = true GROUP BY role'
  );

  const counts: Record<string, number> = {
    viewer: 0,
    uploader: 0,
    'bucket-creator': 0,
    admin: 0,
  };

  result.rows.forEach((row) => {
    counts[row.role] = parseInt(row.count, 10);
  });

  return counts;
}
