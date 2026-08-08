import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import {
  getAllBucketAssignments,
  assignBucketToUser,
  removeBucketAssignment,
} from '@/lib/buckets';
import { getUserByUsername } from '@/lib/users';
import { cookies } from 'next/headers';

async function requireAdmin(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  if (!sessionToken) return null;
  const user = await validateSession(sessionToken);
  if (!user || user.role !== 'admin') return null;
  return user;
}

// GET /api/bucket-assignments — list all assignments (admin only)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const assignments = await getAllBucketAssignments();
    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('GET /api/bucket-assignments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bucket-assignments — assign a user to a bucket (admin only)
// Body: { bucket_id: number, username: string, permission: string }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { bucket_id, username, permission } = body;

    if (!bucket_id || !username || !permission) {
      return NextResponse.json(
        { error: 'bucket_id, username, and permission are required' },
        { status: 400 }
      );
    }

    const targetUser = await getUserByUsername(username);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ok = await assignBucketToUser(Number(bucket_id), targetUser.id, user.id, permission);
    if (!ok) {
      return NextResponse.json({ error: 'Failed to assign user to bucket' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/bucket-assignments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/bucket-assignments — remove a user from a bucket (admin only)
// Body: { bucket_id: number, username: string }
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { bucket_id, username } = body;

    if (!bucket_id || !username) {
      return NextResponse.json(
        { error: 'bucket_id and username are required' },
        { status: 400 }
      );
    }

    const targetUser = await getUserByUsername(username);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ok = await removeBucketAssignment(Number(bucket_id), targetUser.id);
    if (!ok) {
      return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/bucket-assignments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
