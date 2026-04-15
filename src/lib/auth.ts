/**
 * Authentication utilities
 */

import bcrypt from 'bcrypt';
import { query, transaction } from './db';
import { createAuditLog } from './audit';

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface User {
  id: number;
  username: string;
  role: 'viewer' | 'uploader' | 'bucket-creator' | 'admin';
  is_active: boolean;
  must_change_password: boolean;
  last_password_change: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Internal type that includes password_hash for authentication
interface UserWithPassword extends User {
  password_hash: string;
}

export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: Date;
  created_at: Date;
}

/**
 * Authenticate user with username and password
 */
export async function authenticate(
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: User; session: Session } | null> {
  try {
    // Find user by username
    const userResult = await query<UserWithPassword>(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (userResult.rows.length === 0) {
      // Log failed attempt
      await createAuditLog({
        username,
        action: 'login.failed',
        resource_type: 'auth',
        details: { reason: 'user_not_found' },
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'failure',
      });
      return null;
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      // Log failed attempt
      await createAuditLog({
        user_id: user.id,
        username: user.username,
        action: 'login.failed',
        resource_type: 'auth',
        details: { reason: 'invalid_password' },
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'failure',
      });
      return null;
    }

    // Create session
    const session = await createSession(user.id);

    // Log successful login
    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'login.success',
      resource_type: 'auth',
      details: { session_id: session.id },
      ip_address: ipAddress,
      user_agent: userAgent,
      status: 'success',
    });

    return { user, session };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: number): Promise<Session> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const result = await query<Session>(
    `INSERT INTO sessions (user_id, session_token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, sessionToken, expiresAt]
  );

  return result.rows[0];
}

/**
 * Validate session token and return user
 */
export async function validateSession(sessionToken: string): Promise<User | null> {
  try {
    const result = await query<User & Session>(
      `SELECT u.*, s.expires_at
       FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true`,
      [sessionToken]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Destroy a session (logout)
 */
export async function destroySession(
  sessionToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    // Get user before deleting session
    const user = await validateSession(sessionToken);

    await query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);

    if (user) {
      await createAuditLog({
        user_id: user.id,
        username: user.username,
        action: 'logout',
        resource_type: 'auth',
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'success',
      });
    }
  } catch (error) {
    console.error('Destroy session error:', error);
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query('DELETE FROM sessions WHERE expires_at < NOW()');
  return result.rowCount || 0;
}

/**
 * Change user password
 */
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await transaction(async (client) => {
      // Get current user
      const userResult = await client.query<UserWithPassword>(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return { success: false, error: 'User not found' };
      }

      const user = userResult.rows[0];

      // Verify old password (unless it's first login)
      if (!user.must_change_password) {
        const passwordValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!passwordValid) {
          await createAuditLog({
            user_id: userId,
            username: user.username,
            action: 'password.change.failed',
            resource_type: 'auth',
            details: { reason: 'invalid_old_password' },
            ip_address: ipAddress,
            user_agent: userAgent,
            status: 'failure',
          });
          return { success: false, error: 'Current password is incorrect' };
        }
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update password
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             must_change_password = false,
             last_password_change = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [newPasswordHash, userId]
      );

      // Invalidate all existing sessions except current one
      await client.query(
        'DELETE FROM sessions WHERE user_id = $1',
        [userId]
      );

      await createAuditLog({
        user_id: userId,
        username: user.username,
        action: 'password.changed',
        resource_type: 'auth',
        details: { forced: user.must_change_password },
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'success',
      });

      return { success: true };
    });
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Failed to change password' };
  }
}

/**
 * Force password change for a user (admin action)
 */
export async function forcePasswordChange(
  userId: number,
  adminId: number,
  adminUsername: string
): Promise<boolean> {
  try {
    await query(
      'UPDATE users SET must_change_password = true WHERE id = $1',
      [userId]
    );

    const userResult = await query<User>('SELECT username FROM users WHERE id = $1', [userId]);
    const targetUsername = userResult.rows[0]?.username;

    await createAuditLog({
      user_id: adminId,
      username: adminUsername,
      action: 'password.force_change',
      resource_type: 'user',
      resource_id: userId.toString(),
      details: { target_user: targetUsername },
      status: 'success',
    });

    return true;
  } catch (error) {
    console.error('Force password change error:', error);
    return false;
  }
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Optional: require special characters
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push('Password must contain at least one special character');
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}
