import { Router } from 'express';
import { locationSchema, updateBusinessSchema } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { env } from '../config/env.js';

export const businessRouter: Router = Router();

businessRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      include: { subscription: true, locations: { orderBy: { createdAt: 'asc' } } },
    });
    if (!business) throw notFound('Business not found');
    res.json({
      ...business,
      joinUrl: `${env.APP_URL}/j/${business.slug}`,
    });
  }),
);

businessRouter.patch(
  '/',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(updateBusinessSchema, req);
    const business = await prisma.business.update({
      where: { id: ctx.businessId },
      data: { ...input, openingHours: (input.openingHours ?? undefined) as never },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'business.update',
      targetType: 'business',
      targetId: ctx.businessId,
      metadata: { fields: Object.keys(input) },
      ip: clientIp(req),
    });
    res.json(business);
  }),
);

/* ------------------------------------------------------------ locations ---- */

businessRouter.get(
  '/locations',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const locations = await prisma.location.findMany({
      where: {
        businessId: ctx.businessId,
        ...(ctx.locationIds.length > 0 ? { id: { in: ctx.locationIds } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items: locations });
  }),
);

businessRouter.post(
  '/locations',
  requirePermission('location:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(locationSchema, req);
    const location = await prisma.location.create({
      data: { ...input, businessId: ctx.businessId },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'location.create',
      targetType: 'location',
      targetId: location.id,
      ip: clientIp(req),
    });
    res.status(201).json(location);
  }),
);

businessRouter.patch(
  '/locations/:id',
  requirePermission('location:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(locationSchema.partial(), req);
    const { count } = await prisma.location.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: input,
    });
    if (count === 0) throw notFound('Location not found');
    res.json(await prisma.location.findUnique({ where: { id: req.params.id! } }));
  }),
);

businessRouter.delete(
  '/locations/:id',
  requirePermission('location:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { count } = await prisma.location.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: { isActive: false },
    });
    if (count === 0) throw notFound('Location not found');
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'location.disable',
      targetType: 'location',
      targetId: req.params.id!,
      ip: clientIp(req),
    });
    res.status(204).end();
  }),
);
