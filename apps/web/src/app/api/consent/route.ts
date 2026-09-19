import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    memberCode?: string;
    memberToken?: string;
    granted?: boolean;
  };
  if (!body.memberCode || !body.memberToken || typeof body.granted !== 'boolean') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await api(`/v1/public/member/${body.memberCode}/consent`, {
      method: 'POST',
      auth: false,
      body: { granted: body.granted, memberToken: body.memberToken },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false },
      { status: err instanceof ApiError ? err.status : 500 },
    );
  }
}
