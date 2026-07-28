import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/feed/rss.xml`, { next: { revalidate: 600 } });
    if (!res.ok) {
      return new NextResponse('rss unavailable', { status: 502 });
    }
    const xml = await res.text();
    return new NextResponse(xml, {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, s-maxage=600, stale-while-revalidate=1800'
      }
    });
  } catch (err: any) {
    return new NextResponse(`rss unavailable: ${err?.message || err}`, { status: 502 });
  }
}
