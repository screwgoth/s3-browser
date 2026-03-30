import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession } from './lib/auth';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login'];

// Routes that require password change to be completed
const protectedRoutes = ['/', '/users', '/profile', '/bucket-assignments', '/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check session
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    // Redirect to login if not authenticated
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate session
  const user = await validateSession(sessionToken);

  if (!user) {
    // Invalid session - redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session_token');
    return response;
  }

  // Check if user must change password
  if (user.must_change_password) {
    // Allow access to change password endpoints only
    if (
      pathname === '/change-password' ||
      pathname === '/api/auth/change-password' ||
      pathname === '/api/auth/logout' ||
      pathname === '/api/auth/session'
    ) {
      return NextResponse.next();
    }

    // Redirect to change password page
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/change-password', request.url));
    }

    return NextResponse.json(
      { error: 'Password change required', must_change_password: true },
      { status: 403 }
    );
  }

  // User is authenticated and password is up to date
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
