import { Router } from 'express';
import { nfcDeviceSchema, updateNfcDeviceSchema } from '@loyaltyapp/shared';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { badRequest, notFound } from '../lib/errors.js';
import { randomCode, randomToken, sha256 } from '../lib/crypto.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

export const nfcRouter: Router = Router();

nfcRouter.use(requirePermission('nfc:manage'));

const tapUrl = (code: string) => `${env.APP_URL}/t/${code}`;

nfcRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const items = await prisma.nfcDevice.findMany({
      where: { businessId: ctx.businessId },
      include: { location: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: items.map((d) => ({
        id: d.id,
        label: d.label,
        code: d.code,
        isActive: d.isActive,
        tapCount: d.tapCount,
        lastActivityAt: d.lastActivityAt,
        location: d.location,
        tapUrl: tapUrl(d.code),
        createdAt: d.createdAt,
      })),
    });
  }),
);

/** Registers a physical tag. Write tapUrl to the NTAG and print the same as a QR. */
nfcRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(nfcDeviceSchema, req);
    if (input.locationId) {
      const location = await prisma.location.findFirst({
        where: { id: input.locationId, businessId: ctx.businessId },
      });
      if (!location) throw badRequest('Unknown location');
    }

    let code = randomCode(8);
    for (let i = 0; i < 5; i += 1) {
      const clash = await prisma.nfcDevice.findUnique({ where: { code } });
      if (!clash) break;
      code = randomCode(8);
    }

    const device = await prisma.nfcDevice.create({
      data: {
        businessId: ctx.businessId,
        locationId: input.locationId ?? null,
        label: input.label,
        code,
        secretHash: sha256(randomToken(24)),
      },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'nfc.create',
      targetType: 'nfc_device',
      targetId: device.id,
      metadata: { code },
      ip: clientIp(req),
    });
    res.status(201).json({ ...device, tapUrl: tapUrl(device.code) });
  }),
);

nfcRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(updateNfcDeviceSchema, req);
    const { count } = await prisma.nfcDevice.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: input,
    });
    if (count === 0) throw notFound('NFC tag not found');
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: input.isActive === false ? 'nfc.disable' : 'nfc.update',
      targetType: 'nfc_device',
      targetId: req.params.id!,
      metadata: input as Record<string, unknown>,
      ip: clientIp(req),
    });
    const device = await prisma.nfcDevice.findUnique({ where: { id: req.params.id! } });
    res.json({ ...device, tapUrl: device ? tapUrl(device.code) : null });
  }),
);

nfcRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { count } = await prisma.nfcDevice.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: { isActive: false },
    });
    if (count === 0) throw notFound('NFC tag not found');
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'nfc.disable',
      targetType: 'nfc_device',
      targetId: req.params.id!,
      ip: clientIp(req),
    });
    res.status(204).end();
  }),
);
