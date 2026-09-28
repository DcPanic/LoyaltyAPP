import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps a signed-in session alive.
 *
 * Access tokens last fifteen minutes and refreshing rotates the refresh token,
 * so the new pair has to be written somewhere. A page being rendered is not
 * allowed to set cookies — Next refuses it — which is why this cannot live in
 * the page itself: the attempt throws, and what the café owner sees after
 * fifteen minutes away from the screen is a server error on every page.
 *
 * Middleware runs before the render and owns the response, so it is the one
 * place the new cookies can actually be stored. Rotation matters here: a
 * refresh whose result is dropped invalidates the token that was working and
 * signs the person out for real.
 */

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

/** Seconds of remaining life below which it is worth refreshing early. */
const RENEW_WITHIN = 60;

const apiUrl =
  process.env.API_URL ??
  (process.env.API_HOST ? `https://${process.env.API_HOST}` : 'http://localhost:4000');

/**
 * Reads a JWT's expiry without verifying it.
 *
 * Only ever used to decide whether to ask for a new one; the API verifies the
 * signature on every request, so a forged token buys nothing here.
 */
function expiresSoon(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };
    if (typeof exp !== 'number') return true;
    return exp - Date.now() / 1000 < RENEW_WITHIN;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;

  if (!refresh) return NextResponse.next();
  if (access && !expiresSoon(access)) return NextResponse.next();

  const secure = process.env.NODE_ENV === 'production';

  try {
    const res = await fetch(`${apiUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    });

    if (!res.ok) {
      // The refresh token is spent or revoked. Clearing both is what turns the
      // next page into a sign-in screen instead of a loop.
      const cleared = NextResponse.next();
      cleared.cookies.delete(ACCESS);
      cleared.cookies.delete(REFRESH);
      return cleared;
    }

    const data = (await res.json()) as { accessToken: string; refreshToken: string };

    // The render that follows reads cookies from the request, not the response,
    // so the fresh token goes on the request first — otherwise this very page
    // still calls the API with the expired one.
    request.cookies.set(ACCESS, data.accessToken);
    request.cookies.set(REFRESH, data.refreshToken);

    const response = NextResponse.next({ request: { headers: request.headers } });
    const common = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' };
    response.cookies.set(ACCESS, data.accessToken, { ...common, maxAge: 60 * 60 });
    response.cookies.set(REFRESH, data.refreshToken, { ...common, maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch {
    // The API being unreachable is not a reason to sign anyone out.
    return NextResponse.next();
  }
}

export const config = {
  // Static assets and the API proxies do not need a session refreshed.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
