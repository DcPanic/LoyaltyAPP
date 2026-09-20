import crypto from 'node:crypto';
import JSZip from 'jszip';
import forge from 'node-forge';
import { env, appleWalletConfigured } from '../../config/env.js';
import { notConfigured } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { solidPng } from '../png.js';

export interface PassContext {
  serialNumber: string;
  authToken: string;
  businessName: string;
  programName: string;
  rewardName: string;
  rewardDescription?: string | null;
  stamps: number;
  stampsRequired: number;
  rewardAvailable: boolean;
  customerName: string;
  memberCode: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
  /** Picture of the reward, shown as the band across the card. */
  rewardImageUrl?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  updatedTag: string;
}

function rgbCss(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return `rgb(${r}, ${g}, ${b})`;
}

export function stampVisual(stamps: number, required: number): string {
  const filled = Math.min(stamps, required);
  return '●'.repeat(filled) + '○'.repeat(Math.max(0, required - filled));
}

export function buildPassJson(ctx: PassContext): Record<string, unknown> {
  if (!appleWalletConfigured) {
    throw notConfigured('Apple Wallet is not configured on this deployment');
  }
  const remaining = Math.max(0, ctx.stampsRequired - ctx.stamps);

  return {
    formatVersion: 1,
    passTypeIdentifier: env.APPLE_PASS_TYPE_IDENTIFIER!,
    teamIdentifier: env.APPLE_TEAM_IDENTIFIER!,
    serialNumber: ctx.serialNumber,
    organizationName: ctx.businessName,
    description: `${ctx.businessName} loyalty card`,
    logoText: ctx.businessName,
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: rgbCss(ctx.primaryColor),
    labelColor: 'rgb(255, 255, 255)',
    sharingProhibited: true,
    webServiceURL: `${env.API_URL}/v1/wallet/apple`,
    authenticationToken: ctx.authToken,
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: ctx.memberCode,
        messageEncoding: 'iso-8859-1',
        altText: ctx.memberCode.slice(-8),
      },
    ],
    storeCard: {
      headerFields: [
        {
          key: 'balance',
          label: 'STAMPS',
          value: `${ctx.stamps}/${ctx.stampsRequired}`,
        },
      ],
      primaryFields: [
        {
          key: 'stamps',
          label: ctx.programName,
          value: stampVisual(ctx.stamps, ctx.stampsRequired),
        },
      ],
      secondaryFields: [
        {
          key: 'status',
          label: 'STATUS',
          value: ctx.rewardAvailable
            ? `🎁 ${ctx.rewardName} available`
            : `${remaining} more until ${ctx.rewardName}`,
        },
      ],
      auxiliaryFields: [{ key: 'member', label: 'MEMBER', value: ctx.customerName }],
      backFields: [
        { key: 'reward', label: 'Your reward', value: ctx.rewardDescription ?? ctx.rewardName },
        { key: 'program', label: 'How it works', value: `Collect ${ctx.stampsRequired} stamps and get ${ctx.rewardName}.` },
        ...(ctx.addressLine ? [{ key: 'address', label: 'Address', value: ctx.addressLine }] : []),
        ...(ctx.contactPhone ? [{ key: 'phone', label: 'Phone', value: ctx.contactPhone }] : []),
        ...(ctx.termsUrl ? [{ key: 'terms', label: 'Terms', value: ctx.termsUrl }] : []),
        ...(ctx.privacyPolicyUrl
          ? [{ key: 'privacy', label: 'Privacy', value: ctx.privacyPolicyUrl }]
          : []),
        { key: 'updated', label: 'Last updated', value: ctx.updatedTag },
      ],
    },
  };
}

async function fetchImage(url?: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('png')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 && buf.byteLength < 1_500_000 ? buf : null;
  } catch (err) {
    logger.warn({ err, url }, 'Could not fetch pass artwork, using placeholder');
    return null;
  }
}

/**
 * PKCS#7 detached signature over manifest.json, signed with the café platform's
 * own Apple pass certificate (Apple's documented format — no pass provider).
 */
export function signManifest(manifest: Buffer): Buffer {
  const certPem = env.APPLE_PASS_CERT_PEM!;
  const keyPem = env.APPLE_PASS_KEY_PEM!;
  const wwdrPem = env.APPLE_WWDR_CERT_PEM!;

  const cert = forge.pki.certificateFromPem(certPem);
  const wwdr = forge.pki.certificateFromPem(wwdrPem);
  const key = env.APPLE_PASS_KEY_PASSPHRASE
    ? forge.pki.decryptRsaPrivateKey(keyPem, env.APPLE_PASS_KEY_PASSPHRASE)
    : forge.pki.privateKeyFromPem(keyPem);
  if (!key) throw notConfigured('Apple pass private key could not be read');

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString('binary'));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
      { type: forge.pki.oids.messageDigest! },
      { type: forge.pki.oids.signingTime!, value: new Date().toISOString() },
    ],
  });
  p7.sign({ detached: true });

  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

/** Builds a signed .pkpass archive ready to hand to Apple Wallet. */
export async function buildPkPass(ctx: PassContext): Promise<Buffer> {
  const passJson = Buffer.from(JSON.stringify(buildPassJson(ctx)), 'utf8');

  const logo = (await fetchImage(ctx.logoUrl)) ?? solidPng(160, 50, ctx.primaryColor);
  const icon = (await fetchImage(ctx.logoUrl)) ?? solidPng(58, 58, ctx.primaryColor);
  // The band across the card is the café's own picture of the reward when they
  // have given us one; a plain colour is the fallback, not the intention.
  const strip = (await fetchImage(ctx.rewardImageUrl)) ?? solidPng(750, 196, ctx.secondaryColor);

  const files: Record<string, Buffer> = {
    'pass.json': passJson,
    'icon.png': icon,
    'icon@2x.png': icon,
    'logo.png': logo,
    'logo@2x.png': logo,
    'strip.png': strip,
    'strip@2x.png': strip,
  };

  const manifest: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    manifest[name] = crypto.createHash('sha1').update(content).digest('hex');
  }
  const manifestBuf = Buffer.from(JSON.stringify(manifest), 'utf8');
  const signature = signManifest(manifestBuf);

  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  zip.file('manifest.json', manifestBuf);
  zip.file('signature', signature);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
