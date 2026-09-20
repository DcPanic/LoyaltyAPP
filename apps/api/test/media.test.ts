import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, isMediaKind, uploadImage } from '../src/services/media.js';

/**
 * These never reach storage: every case here is refused before the upload is
 * attempted, which is the point. What a café uploads ends up on a wallet pass
 * and on a page customers open from a tag, so the bytes are checked rather
 * than the label the browser put on them.
 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const upload = (bytes: Buffer) =>
  uploadImage({ businessId: 'business-1', kind: 'reward', bytes });

describe('image uploads', () => {
  it('knows which kinds of picture exist', () => {
    expect(isMediaKind('logo')).toBe(true);
    expect(isMediaKind('reward')).toBe(true);
    expect(isMediaKind('../../etc/passwd')).toBe(false);
  });

  it('refuses a file that only claims to be an image', async () => {
    // A PDF, a script, an HTML page: the extension and the content type are the
    // caller's word for it, the first bytes are not.
    await expect(upload(Buffer.from('%PDF-1.7\n%bytes bytes bytes'))).rejects.toThrow(
      /not a PNG, JPEG or WebP/i,
    );
    await expect(upload(Buffer.from('<script>alert(1)</script>'))).rejects.toThrow(
      /not a PNG, JPEG or WebP/i,
    );
  });

  it('refuses an empty file', async () => {
    await expect(upload(Buffer.alloc(0))).rejects.toThrow(/empty/i);
  });

  it('refuses a file over the size limit', async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    await expect(upload(tooBig)).rejects.toThrow(/smaller than/i);
  });

  it('reports plainly when storage has not been set up', async () => {
    // The suite blanks the storage settings, so a real PNG gets this far and
    // then stops — which is exactly what a deployment without a bucket does.
    await expect(upload(PNG)).rejects.toThrow(/not configured/i);
  });
});
