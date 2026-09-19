import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';
import { setMemberCookie } from '@/lib/member-cookie';

interface MemberResponse {
  business: { id: string };
  memberToken: string;
}

/**
 * Remembers the customer's card on this phone so a later NFC tap stamps without
 * asking them anything. Called when a member opens their own card page.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { memberCode } = (await request.json().catch(() => ({}))) as { memberCode?: string };
  if (!memberCode) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const member = await api<MemberResponse>(`/v1/public/member/${memberCode}`, { auth: false });
    setMemberCookie(await cookies(), member.business.id, member.memberToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ ok: false }, { status });
  }
}
