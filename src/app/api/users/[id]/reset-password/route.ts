import { NextRequest, NextResponse } from 'next/server';
import { validateSession, validatePasswordStrength } from '@/lib/auth';
import { resetUserPassword } from '@/lib/users';
import { cookies } from 'next/headers';

// POST /api/users/:id/reset-password - Admin resets a user's password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = await validateSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (admin.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: validation.errors },
        { status: 400 }
      );
    }

    const success = await resetUserPassword(userId, password, admin.id, admin.username);

    if (!success) {
      return NextResponse.json({ error: 'Failed to reset password. User may not exist.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
