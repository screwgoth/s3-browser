import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { getAllBuckets, getBucketsByUserId, getBucketsAssignedToUser, createBucket, getBucketCount } from '@/lib/buckets';
import { clampUploadSize } from '@/lib/upload-limits';
import { cookies } from 'next/headers';

// GET /api/buckets - Get all buckets for current user
export async function GET(request: NextRequest) {
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

    const isAdmin = user.role === 'admin';
    let buckets;

    if (isAdmin) {
      const all = await getAllBuckets(); // includes owner_username via JOIN
      buckets = all.map(b => ({ ...b, is_owned: b.user_id === user.id, permission: null }));
    } else {
      const owned = await getBucketsByUserId(user.id);
      let assigned: Awaited<ReturnType<typeof getBucketsAssignedToUser>> = [];
      try {
        assigned = await getBucketsAssignedToUser(user.id);
      } catch (assignErr) {
        // Table may not exist yet — owned buckets still render; run `npm run db:migrate` to fix
        console.error('getBucketsAssignedToUser failed:', assignErr);
      }
      buckets = [
        ...owned.map(b => ({ ...b, is_owned: true, owner_username: user.username, permission: null })),
        ...assigned, // already carries is_owned:false, owner_username, permission
      ];
    }

    return NextResponse.json({ buckets, count: buckets.length });
  } catch (error) {
    console.error('Get buckets error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/buckets - Create a new bucket
export async function POST(request: NextRequest) {
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

    // Check if user has permission to create buckets
    if (user.role === 'viewer') {
      return NextResponse.json(
        { error: 'You do not have permission to create buckets' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { alias, bucket_name, region, root_folder, access_key_id, secret_access_key, session_token, max_upload_size } = body;

    if (!alias || !bucket_name || !region) {
      return NextResponse.json(
        { error: 'Alias, bucket name, and region are required' },
        { status: 400 }
      );
    }

    // Only admins may set a per-bucket upload limit; others get the app default (null).
    const isAdmin = user.role === 'admin';

    const bucket = await createBucket({
      alias,
      bucket_name,
      region,
      root_folder,
      access_key_id,
      secret_access_key,
      session_token,
      max_upload_size: isAdmin ? (clampUploadSize(max_upload_size) ?? null) : null,
      user_id: user.id,
      username: user.username,
    });

    if (!bucket) {
      return NextResponse.json(
        { error: 'Failed to create bucket' },
        { status: 500 }
      );
    }

    // Don't return credentials in response (security)
    const { access_key_id: _, secret_access_key: __, session_token: ___, ...bucketWithoutCreds } = bucket;

    return NextResponse.json({ bucket: bucketWithoutCreds }, { status: 201 });
  } catch (error) {
    console.error('Create bucket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
