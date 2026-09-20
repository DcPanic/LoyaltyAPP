import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiUrl } from '@/lib/api';

const ALLOWED = new Set(['logo', 'cover', 'reward']);

/**
 * Passes an uploaded picture through to the API.
 *
 * The file goes straight across as bytes: the browser never learns the session
 * token, which stays in the httpOnly cookie on this side, and never learns the
 * storage key, which only the API has. Everything the API refuses — wrong file
 * type, too large, not really an image — comes back with its own message so the
 * person sees why rather than a bare failure.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<NextResponse> {
  const { kind } = await params;
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ message: 'Unknown image kind' }, { status: 404 });
  }

  const token = (await cookies()).get('access_token')?.value;
  if (!token) return NextResponse.json({ message: 'Please sign in again' }, { status: 401 });

  const bytes = await request.arrayBuffer();

  const res = await fetch(`${apiUrl}/v1/media/${kind}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': request.headers.get('content-type') ?? 'application/octet-stream',
    },
    body: bytes,
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as
    | { url?: string; error?: { message?: string } }
    | null;

  if (!res.ok) {
    return NextResponse.json(
      { message: data?.error?.message ?? 'The image could not be uploaded' },
      { status: res.status },
    );
  }
  return NextResponse.json({ url: data?.url });
}
