import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { getBucketById, updateBucket, deleteBucket } from '@/lib/buckets';
import { cookies } from 'next/headers';

// GET /api/buckets/:id - Get a single bucket
export async function GET(
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

    const { id } = await params;
    const bucketId = parseInt(id, 10);

    if (isNaN(bucketId)) {
      return NextResponse.json({ error: 'Invalid bucket ID' }, { status: 400 });
    }

    const bucket = await getBucketById(bucketId, user.id);

    if (!bucket) {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    return NextResponse.json({ bucket });
  } catch (error) {
    console.error('Get bucket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/buckets/:id - Update a bucket
export async function PATCH(
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

    const { id } = await params;
    const bucketId = parseInt(id, 10);

    if (isNaN(bucketId)) {
      return NextResponse.json({ error: 'Invalid bucket ID' }, { status: 400 });
    }

    const body = await request.json();
    const { alias, bucket_name, region, root_folder, access_key_id, secret_access_key, session_token, is_active } = body;

    const bucket = await updateBucket(bucketId, user.id, {
      alias,
      bucket_name,
      region,
      root_folder,
      access_key_id,
      secret_access_key,
      session_token,
      is_active,
      username: user.username,
    });

    if (!bucket) {
      return NextResponse.json(
        { error: 'Failed to update bucket' },
        { status: 500 }
      );
    }

    // Don't return credentials in response
    const { access_key_id: _, secret_access_key: __, session_token: ___, ...bucketWithoutCreds } = bucket;

    return NextResponse.json({ bucket: bucketWithoutCreds });
  } catch (error) {
    console.error('Update bucket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/buckets/:id - Delete a bucket (soft delete)
export async function DELETE(
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

    const { id } = await params;
    const bucketId = parseInt(id, 10);

    if (isNaN(bucketId)) {
      return NextResponse.json({ error: 'Invalid bucket ID' }, { status: 400 });
    }

    const success = await deleteBucket(bucketId, user.id, user.username);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete bucket' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete bucket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
