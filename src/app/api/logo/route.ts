import { NextResponse } from 'next/server';
import { getLogoRecord } from '@/lib/settings';

// Always read fresh from the DB — the logo can change at runtime.
export const dynamic = 'force-dynamic';

export async function GET() {
  const logo = await getLogoRecord();
  if (!logo) {
    return new NextResponse('Logo not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(logo.buffer), {
    status: 200,
    headers: {
      'Content-Type': logo.contentType,
      'Content-Length': String(logo.buffer.length),
      // Clients cache-bust with a query param; keep the DB the source of truth.
      'Cache-Control': 'no-store',
    },
  });
}
