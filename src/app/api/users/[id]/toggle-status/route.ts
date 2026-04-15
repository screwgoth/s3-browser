import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { toggleUserStatus } from '@/lib/users';
import { cookies } from 'next/headers';

// POST /api/users/:id/toggle-status - Toggle user active status (admin only)
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

    const user = await validateSession(sessionToken);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admin can toggle user status
    if (user.role !== 'admin') {
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

    // Prevent self-deactivation
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const updatedUser = await toggleUserStatus(userId, user.id, user.username);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to toggle user status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Toggle user status error:', error);
    
    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message.includes('last admin')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
