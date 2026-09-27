import { NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/** Passes a customer's note to the API. No session involved: it is a public box. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    contact?: string | null;
  };

  try {
    await api(`/v1/public/suggestions/${encodeURIComponent(slug)}`, {
      method: 'POST',
      auth: false,
      body: { message: body.message, contact: body.contact ?? null },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Could not send that' }, { status: 500 });
  }
}
