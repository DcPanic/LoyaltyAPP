import { env, mediaStorageConfigured } from '../config/env.js';
import { badRequest, notConfigured } from '../lib/errors.js';
import { randomToken } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';

/**
 * Artwork the café uploads: its logo, a cover, a picture of the reward.
 *
 * The files live in the operator's own Supabase Storage bucket rather than in
 * the database, because a wallet pass and a phone browser fetch them by URL and
 * a row of bytes would put the API in that path for every render. The service
 * key never leaves this process: the browser posts the file to us, we check it,
 * and we are the ones who talk to storage.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type MediaKind = 'logo' | 'cover' | 'reward';
const KINDS: MediaKind[] = ['logo', 'cover', 'reward'];

export function isMediaKind(value: string): value is MediaKind {
  return (KINDS as string[]).includes(value);
}

/**
 * What the bytes actually are, not what the request claimed they are.
 *
 * A caller can put any content type on a request. Wallet passes and the join
 * page render whatever we hand back from a URL on the café's own domain, so a
 * file that says "image/png" while containing something else is worth refusing
 * before it is ever stored.
 */
function sniffImageType(bytes: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.length < 12) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function storageHeaders(): Record<string, string> {
  const key = env.SUPABASE_SERVICE_KEY!;
  return { authorization: `Bearer ${key}`, apikey: key };
}

/**
 * Stores one image and returns the address it can be read from.
 *
 * The path is scoped by business so one café's artwork can be found, replaced
 * or removed without touching another's, and carries a random suffix so a new
 * upload never has to wait for a cache to forget the old one.
 */
export async function uploadImage(params: {
  businessId: string;
  kind: MediaKind;
  bytes: Buffer;
}): Promise<{ url: string; contentType: string; bytes: number }> {
  // What is wrong with the file is worth saying before what is wrong with the
  // deployment: the first is the person's to fix, the second is not, and a
  // wrongly-picked file should get the same answer either way.
  if (params.bytes.length === 0) throw badRequest('The file is empty');
  if (params.bytes.length > MAX_IMAGE_BYTES) {
    throw badRequest(`Images must be smaller than ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
  }

  const contentType = sniffImageType(params.bytes);
  if (!contentType) throw badRequest('That file is not a PNG, JPEG or WebP image');

  if (!mediaStorageConfigured) {
    throw notConfigured('Image uploads are not configured on this deployment');
  }

  const path = `${params.businessId}/${params.kind}-${randomToken(8)}.${EXTENSION[contentType]}`;
  const base = env.SUPABASE_URL!.replace(/\/$/, '');

  const res = await fetch(`${base}/storage/v1/object/${env.SUPABASE_MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(),
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: new Uint8Array(params.bytes),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error({ status: res.status, detail }, 'Image upload to storage failed');
    throw badRequest('The image could not be stored. Please try again.');
  }

  return {
    url: `${base}/storage/v1/object/public/${env.SUPABASE_MEDIA_BUCKET}/${path}`,
    contentType,
    bytes: params.bytes.length,
  };
}
