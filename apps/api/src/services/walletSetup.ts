import forge from 'node-forge';
import { env, appleWalletConfigured, googleWalletConfigured } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface SetupCheck {
  key: string;
  label: string;
  set: boolean;
  required: boolean;
}

/**
 * Reports what a pass certificate actually is, without ever revealing it.
 * A self-signed certificate is fine for development and is refused by iOS, so
 * saying so plainly here saves a confusing "the pass will not open" later.
 */
function inspectAppleCertificate(): {
  selfSigned: boolean | null;
  commonName: string | null;
  expiresAt: string | null;
} {
  if (!env.APPLE_PASS_CERT_PEM) return { selfSigned: null, commonName: null, expiresAt: null };
  try {
    const cert = forge.pki.certificateFromPem(env.APPLE_PASS_CERT_PEM);
    const subject = cert.subject.getField('CN')?.value ?? null;
    const issuer = cert.issuer.getField('CN')?.value ?? null;
    return {
      selfSigned: Boolean(subject && issuer && subject === issuer),
      commonName: subject,
      expiresAt: cert.validity.notAfter.toISOString(),
    };
  } catch (err) {
    logger.warn({ err }, 'Could not read the Apple pass certificate');
    return { selfSigned: null, commonName: null, expiresAt: null };
  }
}

export async function walletSetupStatus(businessId: string) {
  const certificate = inspectAppleCertificate();

  const appleChecks: SetupCheck[] = [
    {
      key: 'APPLE_PASS_TYPE_IDENTIFIER',
      label: 'Pass Type ID',
      set: Boolean(env.APPLE_PASS_TYPE_IDENTIFIER),
      required: true,
    },
    {
      key: 'APPLE_TEAM_IDENTIFIER',
      label: 'Apple Team ID',
      set: Boolean(env.APPLE_TEAM_IDENTIFIER),
      required: true,
    },
    {
      key: 'APPLE_PASS_CERT_PEM',
      label: 'Pass certificate',
      set: Boolean(env.APPLE_PASS_CERT_PEM),
      required: true,
    },
    {
      key: 'APPLE_PASS_KEY_PEM',
      label: 'Pass private key',
      set: Boolean(env.APPLE_PASS_KEY_PEM),
      required: true,
    },
    {
      key: 'APPLE_WWDR_CERT_PEM',
      label: 'Apple WWDR certificate',
      set: Boolean(env.APPLE_WWDR_CERT_PEM),
      required: true,
    },
    {
      key: 'APPLE_APNS_TOPIC',
      label: 'APNs topic (for live card updates)',
      set: Boolean(env.APPLE_APNS_TOPIC),
      required: false,
    },
  ];

  const googleChecks: SetupCheck[] = [
    {
      key: 'GOOGLE_WALLET_ISSUER_ID',
      label: 'Issuer ID',
      set: Boolean(env.GOOGLE_WALLET_ISSUER_ID),
      required: true,
    },
    {
      key: 'GOOGLE_WALLET_SA_EMAIL',
      label: 'Service account email',
      set: Boolean(env.GOOGLE_WALLET_SA_EMAIL),
      required: true,
    },
    {
      key: 'GOOGLE_WALLET_SA_PRIVATE_KEY',
      label: 'Service account private key',
      set: Boolean(env.GOOGLE_WALLET_SA_PRIVATE_KEY),
      required: true,
    },
  ];

  const [applePasses, googlePasses, appleDevices, lastPush] = await Promise.all([
    prisma.walletPass.count({ where: { businessId, platform: 'APPLE', revokedAt: null } }),
    prisma.walletPass.count({ where: { businessId, platform: 'GOOGLE', revokedAt: null } }),
    prisma.walletDeviceRegistration.count({
      where: { pass: { businessId, revokedAt: null } },
    }),
    prisma.walletPass.findFirst({
      where: { businessId, lastPushedAt: { not: null } },
      orderBy: { lastPushedAt: 'desc' },
      select: { lastPushedAt: true, platform: true },
    }),
  ]);

  const publicUrl = env.API_URL.startsWith('https://');

  return {
    apple: {
      configured: appleWalletConfigured,
      checks: appleChecks,
      passTypeIdentifier: env.APPLE_PASS_TYPE_IDENTIFIER ?? null,
      certificate,
      passes: applePasses,
      devices: appleDevices,
    },
    google: {
      configured: googleWalletConfigured,
      checks: googleChecks,
      issuerId: env.GOOGLE_WALLET_ISSUER_ID ?? null,
      passes: googlePasses,
    },
    webService: {
      url: `${env.API_URL}/v1/wallet/apple`,
      https: publicUrl,
    },
    lastPush: lastPush
      ? { at: lastPush.lastPushedAt?.toISOString() ?? null, platform: lastPush.platform }
      : null,
  };
}
