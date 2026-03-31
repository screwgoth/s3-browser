/**
 * Server-side session utilities
 * Use these in Server Components and API routes
 */

import { cookies } from 'next/headers';
import { validateSession } from './auth';
import { redirect } from 'next/navigation';

/**
 * Get current user from session (Server Component)
 * Redirects to login if not authenticated
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const user = await validateSession(sessionToken);

  if (!user) {
    redirect('/login');
  }

  return user;
}

/**
 * Get current user from session (optional)
 * Returns null if not authenticated instead of redirecting
 */
export async function getCurrentUserOptional() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    return null;
  }

  const user = await validateSession(sessionToken);
  return user;
}

/**
 * Require admin role
 * Redirects to home if not admin
 */
export async function requireAdmin() {
  const user = await getCurrentUser();

  if (user.role !== 'admin') {
    redirect('/');
  }

  return user;
}

/**
 * Check if password change is required
 * Redirects to change-password page if needed
 */
export async function checkPasswordChangeRequired() {
  const user = await getCurrentUser();

  if (user.must_change_password) {
    redirect('/change-password');
  }

  return user;
}
