import { Router } from 'express';
import { campaignSchema } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { resolveAudience, runCampaign } from '../services/campaigns.js';
import { recordAudit } from '../services/audit.js';

export const campaignRouter: Router = Router();

campaignRouter.use(requirePermission('campaign:manage'));

campaignRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    res.json({
      items: await prisma.campaign.findMany({
        where: { businessId: ctx.businessId },
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);

campaignRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(campaignSchema, req);
    const campaign = await prisma.campaign.create({
      data: {
        businessId: ctx.businessId,
        name: input.name,
        type: input.type,
        message: input.message,
        segments: input.segments,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        stampMultiplier: input.stampMultiplier ?? 1,
        isActive: input.isActive ?? true,
      },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'campaign.create',
      targetType: 'campaign',
      targetId: campaign.id,
      ip: clientIp(req),
    });
    res.status(201).json(campaign);
  }),
);

campaignRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(campaignSchema.partial(), req);
    const { count } = await prisma.campaign.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: {
        ...input,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });
    if (count === 0) throw notFound('Campaign not found');
    res.json(await prisma.campaign.findUnique({ where: { id: req.params.id! } }));
  }),
);

campaignRouter.get(
  '/:id/audience',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const audience = await resolveAudience(ctx.businessId, req.params.id!);
    res.json({ size: audience.length, items: audience.slice(0, 200) });
  }),
);

campaignRouter.post(
  '/:id/run',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const result = await runCampaign(ctx.businessId, req.params.id!, {
      userId: ctx.userId,
      label: ctx.name,
    });
    res.json({ campaign: result.campaign, audienceSize: result.audienceSize });
  }),
);
