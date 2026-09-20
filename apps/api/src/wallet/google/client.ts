import jwt from 'jsonwebtoken';
import { env, googleWalletConfigured } from '../../config/env.js';
import { notConfigured } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

let cachedToken: { value: string; expiresAt: number } | null = null;

function privateKey(): string {
  // Service-account keys are usually stored with escaped newlines in env vars.
  return (env.GOOGLE_WALLET_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
}

/** Service-account access token via the JWT bearer grant (no extra SDK). */
async function accessToken(): Promise<string> {
  if (!googleWalletConfigured) throw notConfigured('Google Wallet is not configured');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: env.GOOGLE_WALLET_SA_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    privateKey(),
    { algorithm: 'RS256' },
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google Wallet token request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const token = await accessToken();
  return fetch(`${WALLET_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export interface GoogleClassInput {
  classId: string;
  businessName: string;
  programName: string;
  rewardName: string;
  primaryColor: string;
  logoUrl?: string | null;
  /** Picture of the reward, shown across the top of the card. */
  rewardImageUrl?: string | null;
  homepageUrl: string;
}

export interface GoogleObjectInput {
  objectId: string;
  classId: string;
  customerName: string;
  memberCode: string;
  stamps: number;
  stampsRequired: number;
  rewardAvailable: boolean;
  rewardName: string;
  memberPageUrl: string;
}

function classBody(input: GoogleClassInput) {
  return {
    id: input.classId,
    issuerName: input.businessName,
    programName: input.programName,
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: input.primaryColor,
    ...(input.logoUrl
      ? {
          programLogo: {
            sourceUri: { uri: input.logoUrl },
            contentDescription: { defaultValue: { language: 'en', value: input.businessName } },
          },
        }
      : {}),
    ...(input.rewardImageUrl
      ? {
          heroImage: {
            sourceUri: { uri: input.rewardImageUrl },
            contentDescription: { defaultValue: { language: 'en', value: input.rewardName } },
          },
        }
      : {}),
    homepageUri: {
      uri: input.homepageUrl,
      description: input.businessName,
    },
    rewardsTier: input.rewardName,
  };
}

function objectBody(input: GoogleObjectInput) {
  const remaining = Math.max(0, input.stampsRequired - input.stamps);
  return {
    id: input.objectId,
    classId: input.classId,
    state: 'ACTIVE',
    accountName: input.customerName,
    accountId: input.memberCode,
    barcode: {
      type: 'QR_CODE',
      value: input.memberCode,
      alternateText: input.memberCode.slice(-8),
    },
    loyaltyPoints: {
      label: 'Stamps',
      balance: { string: `${input.stamps}/${input.stampsRequired}` },
    },
    textModulesData: [
      {
        id: 'status',
        header: 'Status',
        body: input.rewardAvailable
          ? `${input.rewardName} available — show this card to the barista`
          : `${remaining} more stamp(s) until ${input.rewardName}`,
      },
    ],
    linksModuleData: {
      uris: [{ uri: input.memberPageUrl, description: 'My loyalty card' }],
    },
  };
}

export async function upsertLoyaltyClass(input: GoogleClassInput): Promise<void> {
  const body = classBody(input);
  const existing = await call(`/loyaltyClass/${encodeURIComponent(input.classId)}`, { method: 'GET' });
  const res =
    existing.status === 404
      ? await call('/loyaltyClass', { method: 'POST', body: JSON.stringify(body) })
      : await call(`/loyaltyClass/${encodeURIComponent(input.classId)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
  if (!res.ok) throw new Error(`Google Wallet class upsert failed: ${res.status} ${await res.text()}`);
}

export async function upsertLoyaltyObject(input: GoogleObjectInput): Promise<void> {
  const body = objectBody(input);
  const existing = await call(`/loyaltyObject/${encodeURIComponent(input.objectId)}`, { method: 'GET' });
  const res =
    existing.status === 404
      ? await call('/loyaltyObject', { method: 'POST', body: JSON.stringify(body) })
      : await call(`/loyaltyObject/${encodeURIComponent(input.objectId)}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
  if (!res.ok) throw new Error(`Google Wallet object upsert failed: ${res.status} ${await res.text()}`);
}

export async function expireLoyaltyObject(objectId: string): Promise<void> {
  const res = await call(`/loyaltyObject/${encodeURIComponent(objectId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'EXPIRED' }),
  });
  if (!res.ok) logger.warn({ objectId, status: res.status }, 'Could not expire Google Wallet object');
}

/** "Add to Google Wallet" link: a signed save JWT pointing at our object. */
export function saveLink(objectId: string, classId: string): string {
  if (!googleWalletConfigured) throw notConfigured('Google Wallet is not configured');
  const claims = {
    iss: env.GOOGLE_WALLET_SA_EMAIL,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [env.APP_URL],
    payload: { loyaltyObjects: [{ id: objectId, classId }] },
  };
  const token = jwt.sign(claims, privateKey(), { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
