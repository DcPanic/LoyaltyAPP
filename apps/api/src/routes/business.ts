import { Router } from 'express';
import {
  businessLinkSchema,
  locationSchema,
  updateBusinessLinkSchema,
  updateBusinessSchema,
} from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { walletSetupStatus } from '../services/walletSetup.js';
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

/* ------------------------------------------------ the counter code page ---- */

/**
 * The rows a café shows on the page its QR code opens.
 *
 * Ordinary settings, so they sit behind the same permission as the rest of the
 * branding: whoever chooses the colours chooses what else the page offers.
 */
businessRouter.get(
  '/links',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    res.json({
      items: await prisma.businessLink.findMany({
        where: { businessId: ctx.businessId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    });
  }),
);

businessRouter.post(
  '/links',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(businessLinkSchema, req);

    // New rows go to the end rather than fighting over position 0.
    const last = await prisma.businessLink.findFirst({
      where: { businessId: ctx.businessId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const link = await prisma.businessLink.create({
      data: {
        businessId: ctx.businessId,
        kind: input.kind,
        label: input.label,
        url: input.url ?? null,
        value: input.value ?? null,
        sortOrder: input.sortOrder ?? (last ? last.sortOrder + 1 : 0),
        isActive: input.isActive ?? true,
      },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'link.create',
      targetType: 'link',
      targetId: link.id,
      metadata: { kind: link.kind },
      ip: clientIp(req),
    });
    res.status(201).json(link);
  }),
);

businessRouter.patch(
  '/links/:id',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(updateBusinessLinkSchema, req);
    const { count } = await prisma.businessLink.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: input,
    });
    if (count === 0) throw notFound('Link not found');
    res.json(await prisma.businessLink.findUnique({ where: { id: req.params.id! } }));
  }),
);

businessRouter.delete(
  '/links/:id',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { count } = await prisma.businessLink.deleteMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
    });
    if (count === 0) throw notFound('Link not found');
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'link.delete',
      targetType: 'link',
      targetId: req.params.id!,
      ip: clientIp(req),
    });
    res.status(204).end();
  }),
);

/** Notes customers left from that page. */
businessRouter.get(
  '/suggestions',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const items = await prisma.suggestion.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { customer: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ items, unread: items.filter((s) => !s.readAt).length });
  }),
);

businessRouter.post(
  '/suggestions/:id/read',
  requirePermission('customer:read'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { count } = await prisma.suggestion.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: { readAt: new Date() },
    });
    if (count === 0) throw notFound('Suggestion not found');
    res.status(204).end();
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

/** What is needed before customers can add the card to their phone's wallet. */
businessRouter.get(
  '/wallet',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    res.json(await walletSetupStatus(ctx.businessId));
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
