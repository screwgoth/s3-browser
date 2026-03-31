/**
 * Middleware-safe authentication utilities
 * Does not import bcrypt or other Node.js-only modules
 */

import { query } from './db';

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

/**
 * Validate session token (middleware-safe version)
 * Does not use bcrypt, only database query
 */
export async function validateSessionMiddleware(sessionToken: string): Promise<User | null> {
  try {
    const result = await query<User>(
      `SELECT u.id, u.username, u.role, u.is_active, u.must_change_password, 
              u.last_password_change, u.created_at, u.updated_at
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
