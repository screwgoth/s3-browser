import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await validateSession(sessionToken);

    if (!user) {
      // Invalid or expired session
      cookieStore.delete('session_token');
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
