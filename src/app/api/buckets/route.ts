import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { getBucketsByUserId, createBucket, getBucketCount } from '@/lib/buckets';
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

    const buckets = await getBucketsByUserId(user.id);
    const count = await getBucketCount(user.id);

    return NextResponse.json({
      buckets,
      count,
    });
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
    const { alias, bucket_name, region, root_folder, access_key_id, secret_access_key, session_token } = body;

    if (!alias || !bucket_name || !region) {
      return NextResponse.json(
        { error: 'Alias, bucket name, and region are required' },
        { status: 400 }
      );
    }

    const bucket = await createBucket({
      alias,
      bucket_name,
      region,
      root_folder,
      access_key_id,
      secret_access_key,
      session_token,
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
