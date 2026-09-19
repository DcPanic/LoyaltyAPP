import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

export type TokenAudience = 'access' | 'member' | 'invite' | 'staff-scan';

interface BaseClaims {
  aud: TokenAudience;
}

export interface AccessClaims extends BaseClaims {
  aud: 'access';
  sub: string; // user id
  bid: string; // business id
  mid: string; // staff membership id
}

export interface MemberClaims extends BaseClaims {
  aud: 'member';
  sub: string; // customer id
  bid: string; // business id
  mem: string; // loyalty membership id
}

export interface InviteClaims extends BaseClaims {
  aud: 'invite';
  sub: string; // invite id
  bid: string;
}

/** Short-lived token encoded in the customer QR shown on the Wallet pass. */
export interface ScanClaims extends BaseClaims {
  aud: 'staff-scan';
  sub: string; // customer id
  bid: string;
  mem: string;
}

function sign(payload: object, aud: TokenAudience, expiresIn: string | number): string {
  const options: SignOptions = { audience: aud, expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

function verify<T>(token: string, aud: TokenAudience): T {
  try {
    return jwt.verify(token, env.JWT_SECRET, { audience: aud }) as T;
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

export const signAccessToken = (c: Omit<AccessClaims, 'aud'>) =>
  sign(c, 'access', env.ACCESS_TOKEN_TTL);
export const verifyAccessToken = (t: string) => verify<AccessClaims>(t, 'access');

/** Long-lived: identifies the customer on NFC/QR web flows without a customer app. */
export const signMemberToken = (c: Omit<MemberClaims, 'aud'>) =>
  sign(c, 'member', `${env.MEMBER_TOKEN_TTL_DAYS}d`);
export const verifyMemberToken = (t: string) => verify<MemberClaims>(t, 'member');

export const signInviteToken = (c: Omit<InviteClaims, 'aud'>) => sign(c, 'invite', '14d');
export const verifyInviteToken = (t: string) => verify<InviteClaims>(t, 'invite');

/** Rotated every 60s on the member page so a screenshot of a QR is not a permanent key. */
export const signScanToken = (c: Omit<ScanClaims, 'aud'>) => sign(c, 'staff-scan', '120s');
export const verifyScanToken = (t: string) => verify<ScanClaims>(t, 'staff-scan');
