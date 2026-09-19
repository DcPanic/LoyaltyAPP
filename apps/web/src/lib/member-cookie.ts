import type { cookies } from 'next/headers';

type Jar = Awaited<ReturnType<typeof cookies>>;

/**
 * One cookie per café: a customer can hold cards from several cafés on the same
 * phone, and a tag from café A must never resolve a membership of café B.
 */
export const memberCookieName = (businessId: string) => `lam_${businessId}`;

export function setMemberCookie(jar: Jar, businessId: string, token: string): void {
  jar.set(memberCookieName(businessId), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 730,
  });
}

export const getMemberCookie = (jar: Jar, businessId: string): string | undefined =>
  jar.get(memberCookieName(businessId))?.value;
