import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Permission, Role } from '@loyaltyapp/shared';
import { api, ApiError } from './api';

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
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
    joinUrl: string;
    posterUrl: string;
    qrImageUrl: string;
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

/**
 * Reads the session.
 *
 * Renewal is not done here. A page being rendered may not set cookies, so a
 * refresh at this point either throws or quietly drops the rotated token and
 * signs the person out for real on the next click. `middleware.ts` does it
 * instead, before the render, where the response is still ours to write to —
 * so by the time this runs the access token is already fresh.
 */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  if (!jar.get(ACCESS)) return null;

  try {
    return await api<Session>('/v1/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
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
