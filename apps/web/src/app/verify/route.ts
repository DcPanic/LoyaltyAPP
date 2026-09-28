import { NextResponse, type NextRequest } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * The link from the confirmation email.
 *
 * A route handler rather than a page, because confirming signs the person in
 * and a page being rendered may not set cookies — the same rule that had the
 * dashboard failing after fifteen minutes. Here the response is ours to write.
 *
 * Signing them in is deliberate: they have just proved they can read the
 * address, which is a stronger thing than the password they would otherwise be
 * asked for, and asking anyway right after they clicked a link is the sort of
 * step people abandon.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');
  const origin = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(new URL('/login?confirm=missing', origin));
  }

  try {
    const result = await api<{
      verified: true;
      accessToken?: string;
      refreshToken?: string;
    }>('/v1/auth/verify-email', { method: 'POST', body: { token }, auth: false });

    // Not attached to a café yet — an invitation they have not accepted. The
    // address is confirmed either way; there is just nowhere to land.
    if (!result.accessToken || !result.refreshToken) {
      return NextResponse.redirect(new URL('/login?confirm=ok', origin));
    }

    const response = NextResponse.redirect(new URL('/dashboard?confirm=ok', origin));
    const common = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
    response.cookies.set('access_token', result.accessToken, { ...common, maxAge: 60 * 60 });
    response.cookies.set('refresh_token', result.refreshToken, {
      ...common,
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    const reason = err instanceof ApiError ? 'expired' : 'failed';
    return NextResponse.redirect(new URL(`/login?confirm=${reason}`, origin));
  }
}
