import { Router } from 'express';
import { z } from 'zod';
import { loyaltyProgramSchema, rewardSchema } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

export const programRouter: Router = Router();

programRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const items = await prisma.loyaltyProgram.findMany({
      where: { businessId: ctx.businessId },
      include: { rewards: true, _count: { select: { memberships: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items });
  }),
);

programRouter.post(
  '/',
  requirePermission('program:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(loyaltyProgramSchema, req);
    const program = await prisma.loyaltyProgram.create({
      data: { ...input, businessId: ctx.businessId },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'program.create',
      targetType: 'program',
      targetId: program.id,
      ip: clientIp(req),
    });
    res.status(201).json(program);
  }),
);

programRouter.patch(
  '/:id',
  requirePermission('program:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(loyaltyProgramSchema.partial(), req);
    const { count } = await prisma.loyaltyProgram.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: input,
    });
    if (count === 0) throw notFound('Loyalty program not found');
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'program.update',
      targetType: 'program',
      targetId: req.params.id!,
      metadata: { fields: Object.keys(input) },
      ip: clientIp(req),
    });
    res.json(await prisma.loyaltyProgram.findUnique({ where: { id: req.params.id! } }));
  }),
);

/* -------------------------------------------------------------- rewards ---- */

export const rewardRouter: Router = Router();

rewardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const items = await prisma.reward.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { redemptions: true } } },
    });
    res.json({ items });
  }),
);

rewardRouter.post(
  '/',
  requirePermission('reward:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(rewardSchema.extend({ programId: z.string().min(8).optional() }), req);
    const { programId, ...reward } = input;
    const created = await prisma.reward.create({
      data: { ...reward, programId: programId ?? null, businessId: ctx.businessId },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'reward.create',
      targetType: 'reward',
      targetId: created.id,
      ip: clientIp(req),
    });
    res.status(201).json(created);
  }),
);

rewardRouter.patch(
  '/:id',
  requirePermission('reward:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(rewardSchema.partial(), req);
    const { count } = await prisma.reward.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: input,
    });
    if (count === 0) throw notFound('Reward not found');
    res.json(await prisma.reward.findUnique({ where: { id: req.params.id! } }));
  }),
);

rewardRouter.get(
  '/redemptions',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const items = await prisma.rewardRedemption.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { earnedAt: 'desc' },
      take: 100,
      include: { customer: true, reward: true, location: true },
    });
    res.json({ items });
  }),
);
