import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { getMemberCookie } from '@/lib/member-cookie';

interface TagInfo {
  business: { id: string; name: string; slug: string };
}

/**
 * NFC tap handler. The tag identifies the café; the customer is identified by
 * the café-scoped member cookie on their own phone. One POST, no navigation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  const jar = await cookies();

  try {
    const tag = await api<TagInfo>(`/v1/public/tag/${code}`, { auth: false });
    const memberToken = getMemberCookie(jar, tag.business.id);
    if (!memberToken) {
      return NextResponse.json(
        { status: 'unknown_member', joinUrl: `/j/${tag.business.slug}` },
        { status: 200 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { requestId?: string };
    const result = await api<unknown>(`/v1/public/tap/${code}`, {
      method: 'POST',
      auth: false,
      body: { memberToken, requestId: body.requestId },
    });
    return NextResponse.json({ status: 'stamped', result });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { status: 'error', code: err.code, message: err.message },
        { status: err.status === 429 ? 200 : err.status },
      );
    }
    return NextResponse.json({ status: 'error', message: 'Could not add your stamp' }, { status: 500 });
  }
}
