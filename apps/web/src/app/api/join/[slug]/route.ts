import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { setMemberCookie } from '@/lib/member-cookie';

interface JoinResponse {
  membershipId: string;
  memberCode: string;
  memberToken: string;
  memberPageUrl: string;
  business: { id: string };
  wallet: { apple: string | null; google: string | null };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await api<JoinResponse>(`/v1/public/join/${slug}`, {
      method: 'POST',
      auth: false,
      body,
    });
    setMemberCookie(await cookies(), result.business.id, result.memberToken);
    return NextResponse.json({
      ok: true,
      memberCode: result.memberCode,
      memberPageUrl: result.memberPageUrl,
      wallet: result.wallet,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { ok: false, message: err.message, details: err.details },
        { status: err.status },
      );
    }
    return NextResponse.json({ ok: false, message: 'Could not create your card' }, { status: 500 });
  }
}
