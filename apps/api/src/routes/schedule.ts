import { Router } from 'express';
import { scheduleRangeSchema, shiftSchema, updateShiftSchema } from '@loyaltyapp/shared';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { badRequest, notFound } from '../lib/errors.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';

export const scheduleRouter: Router = Router();

const MAX_RANGE_DAYS = 120;

function range(req: Parameters<typeof auth>[0] & { query: Record<string, unknown> }) {
  const parsed = scheduleRangeSchema.safeParse({
    from: String(req.query.from ?? ''),
    to: String(req.query.to ?? ''),
  });
  if (!parsed.success) throw badRequest('Give a from and to date');
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (to <= from) throw badRequest('The end of the range has to be after the start');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw badRequest(`Ask for at most ${MAX_RANGE_DAYS} days at a time`);
  }
  return { from, to };
}

/**
 * The rota.
 *
 * Who sees what is decided here rather than in either app:
 *
 *  - whoever may manage the rota sees everything, published or not, because
 *    they are the one writing it;
 *  - everyone else sees only published shifts, so next month can be built and
 *    rearranged without the team planning their lives around a draft;
 *  - and of those, someone whose membership has `seesFullSchedule` turned off
 *    sees only the shifts they work.
 */
scheduleRouter.get(
  '/',
  requirePermission('schedule:read', 'schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { from, to } = range(req as never);
    const manages = ctx.permissions.includes('schedule:manage');

    const membership = await prisma.staffMembership.findFirst({
      where: { businessId: ctx.businessId, userId: ctx.userId },
      select: { id: true, seesFullSchedule: true },
    });
    if (!membership) throw notFound('You are not on this café');

    const mine = !manages && !membership.seesFullSchedule;

    const shifts = await prisma.shift.findMany({
      where: {
        businessId: ctx.businessId,
        startsAt: { gte: from, lt: to },
        ...(manages ? {} : { publishedAt: { not: null } }),
        ...(mine ? { staffMembershipId: membership.id } : {}),
      },
      orderBy: [{ startsAt: 'asc' }],
      include: {
        membership: { include: { user: { select: { id: true, name: true } } } },
        location: { select: { id: true, name: true } },
      },
    });

    res.json({
      canManage: manages,
      scope: mine ? 'mine' : 'everyone',
      myMembershipId: membership.id,
      items: shifts.map((s) => ({
        id: s.id,
        staffMembershipId: s.staffMembershipId,
        staffName: s.membership.user.name,
        locationId: s.locationId,
        locationName: s.location?.name ?? null,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        note: s.note,
        published: s.publishedAt !== null,
      })),
    });
  }),
);

/** Who can be put on a shift. Separate from /v1/staff, which owners only see. */
scheduleRouter.get(
  '/people',
  requirePermission('schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const people = await prisma.staffMembership.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      items: people.map((p) => ({
        id: p.id,
        name: p.user.name,
        role: p.role,
        seesFullSchedule: p.seesFullSchedule,
      })),
    });
  }),
);

scheduleRouter.post(
  '/',
  requirePermission('schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(shiftSchema, req);

    // The person has to be on this café. Taking the id from the body without
    // checking would let one café roster another café's staff.
    const person = await prisma.staffMembership.findFirst({
      where: { id: input.staffMembershipId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!person) throw notFound('That person is not on this café');

    const shift = await prisma.shift.create({
      data: {
        businessId: ctx.businessId,
        staffMembershipId: person.id,
        locationId: input.locationId ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        note: input.note ?? null,
      },
    });
    res.status(201).json(shift);
  }),
);

scheduleRouter.patch(
  '/:id',
  requirePermission('schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(updateShiftSchema, req);

    if (input.staffMembershipId) {
      const person = await prisma.staffMembership.findFirst({
        where: { id: input.staffMembershipId, businessId: ctx.businessId },
        select: { id: true },
      });
      if (!person) throw notFound('That person is not on this café');
    }

    const { count } = await prisma.shift.updateMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
      data: {
        ...(input.staffMembershipId ? { staffMembershipId: input.staffMembershipId } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId ?? null } : {}),
        ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
        ...(input.endsAt ? { endsAt: new Date(input.endsAt) } : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
      },
    });
    if (count === 0) throw notFound('Shift not found');
    res.json(await prisma.shift.findUnique({ where: { id: req.params.id! } }));
  }),
);

scheduleRouter.delete(
  '/:id',
  requirePermission('schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const { count } = await prisma.shift.deleteMany({
      where: { id: req.params.id!, businessId: ctx.businessId },
    });
    if (count === 0) throw notFound('Shift not found');
    res.status(204).end();
  }),
);

/**
 * Hand a stretch of the rota to the team.
 *
 * Publishing covers a range rather than one shift, because a rota is read as a
 * week: releasing it a shift at a time would show the team a week with holes in
 * it and have them ask about the gaps.
 */
scheduleRouter.post(
  '/publish',
  requirePermission('schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(scheduleRangeSchema, req);
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (to <= from) throw badRequest('The end of the range has to be after the start');

    const { count } = await prisma.shift.updateMany({
      where: {
        businessId: ctx.businessId,
        startsAt: { gte: from, lt: to },
        publishedAt: null,
      },
      data: { publishedAt: new Date() },
    });

    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'schedule.publish',
      targetType: 'schedule',
      targetId: from.toISOString().slice(0, 10),
      metadata: { from: input.from, to: input.to, shifts: count },
      ip: clientIp(req),
    });

    res.json({ published: count });
  }),
);

/** Taking a published stretch back, for a week that has to be redone. */
scheduleRouter.post(
  '/unpublish',
  requirePermission('schedule:manage'),
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(scheduleRangeSchema, req);
    const { count } = await prisma.shift.updateMany({
      where: {
        businessId: ctx.businessId,
        startsAt: { gte: new Date(input.from), lt: new Date(input.to) },
        publishedAt: { not: null },
      },
      data: { publishedAt: null },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'schedule.unpublish',
      targetType: 'schedule',
      targetId: new Date(input.from).toISOString().slice(0, 10),
      metadata: { shifts: count },
      ip: clientIp(req),
    });
    res.json({ unpublished: count });
  }),
);
