import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login'];

// Routes that require authentication but should be accessible even with expired/invalid sessions
// (for checking session status or forcing password change)
const authCheckRoutes = ['/api/auth/session', '/api/auth/change-password', '/change-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow auth check routes (these routes handle their own auth validation)
  if (authCheckRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if session cookie exists
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    // Redirect to login if not authenticated
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Session exists - let the request through
  // Actual validation will happen in API routes and server components
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
