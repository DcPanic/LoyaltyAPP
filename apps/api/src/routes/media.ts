import express, { Router } from 'express';
import { mediaStorageConfigured } from '../config/env.js';
import { asyncHandler, clientIp } from '../lib/http.js';
import { badRequest } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { MAX_IMAGE_BYTES, isMediaKind, uploadImage } from '../services/media.js';

export const mediaRouter: Router = Router();

/** Says whether the dashboard should offer a file picker or only an address. */
mediaRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({ uploadsEnabled: mediaStorageConfigured, maxBytes: MAX_IMAGE_BYTES });
  }),
);

/**
 * Takes the image itself, as raw bytes.
 *
 * Whoever may change the branding or the loyalty program may upload the picture
 * that goes with it — the two are the same act, split across two screens. The
 * body is read as bytes rather than a multipart form: one file, no field names,
 * nothing to parse, and no extra dependency.
 */
mediaRouter.post(
  '/:kind',
  requirePermission('settings:manage', 'program:manage'),
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES + 1024 }),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const kind = String(req.params.kind);
    if (!isMediaKind(kind)) throw badRequest('Unknown image kind');

    const body: unknown = req.body;
    if (!Buffer.isBuffer(body)) throw badRequest('Send the image itself as the request body');

    const stored = await uploadImage({ businessId: ctx.businessId, kind, bytes: body });

    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'media.upload',
      targetType: 'media',
      targetId: kind,
      metadata: { url: stored.url, bytes: stored.bytes, contentType: stored.contentType },
      ip: clientIp(req),
    });

    res.status(201).json(stored);
  }),
);
