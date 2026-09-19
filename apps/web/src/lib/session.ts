import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Permission, Role } from '@loyaltyapp/shared';
import { api, ApiError } from './api';

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    businessId: string;
    role: Role;
    permissions: Permission[];
    locationIds: string[];
  };
  business: {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string | null;
    currency: string;
    timezone: string;
    country: string;
  };
}

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  jar.set(ACCESS, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60,
  });
  jar.set(REFRESH, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearTokens(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

/** Reads the session, transparently refreshing an expired access token once. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  if (!jar.get(ACCESS) && !jar.get(REFRESH)) return null;

  try {
    return await api<Session>('/v1/auth/me');
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const refreshToken = jar.get(REFRESH)?.value;
  if (!refreshToken) return null;

  try {
    const refreshed = await api<Session & { accessToken: string; refreshToken: string }>(
      '/v1/auth/refresh',
      { method: 'POST', body: { refreshToken }, auth: false },
    );
    await storeTokens(refreshed.accessToken, refreshed.refreshToken);
    return { user: refreshed.user, business: refreshed.business };
  } catch {
    await clearTokens();
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireSession();
  if (!session.user.permissions.includes(permission)) redirect('/stamp');
  return session;
}

export const can = (session: Session, permission: Permission): boolean =>
  session.user.permissions.includes(permission);
