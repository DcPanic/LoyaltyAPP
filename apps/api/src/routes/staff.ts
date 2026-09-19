import { Router } from 'express';
import { inviteStaffSchema, permissionsForRole, updateStaffSchema, type Role } from '@loyaltyapp/shared';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { signInviteToken } from '../lib/tokens.js';
import { auth, requirePermission } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { logger } from '../lib/logger.js';

export const staffRouter: Router = Router();

staffRouter.use(requirePermission('staff:manage'));

staffRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const [members, invites] = await Promise.all([
      prisma.staffMembership.findMany({
        where: { businessId: ctx.businessId },
        include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.staffInvite.findMany({
        where: { businessId: ctx.businessId, acceptedAt: null, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      items: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        permissions: m.permissions.length > 0 ? m.permissions : permissionsForRole(m.role as Role),
        locationIds: m.locationIds,
        isActive: m.isActive,
        lastLoginAt: m.user.lastLoginAt,
      })),
      invites: invites.map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
      })),
    });
  }),
);

/**
 * Invite a staff member. The link is returned to the owner so it can be shared
 * directly; an email provider plugs in here without changing the flow.
 */
staffRouter.post(
  '/invite',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(inviteStaffSchema, req);

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      include: { staffMemberships: { where: { businessId: ctx.businessId } } },
    });
    if (existing && existing.staffMemberships.length > 0) {
      throw conflict('This person is already part of your team');
    }
    if (input.locationIds.length > 0) {
      const count = await prisma.location.count({
        where: { id: { in: input.locationIds }, businessId: ctx.businessId },
      });
      if (count !== input.locationIds.length) throw badRequest('Unknown location');
    }

    const invite = await prisma.staffInvite.create({
      data: {
        businessId: ctx.businessId,
        email: input.email,
        name: input.name,
        role: input.role,
        permissions: input.permissions ?? [],
        locationIds: input.locationIds,
        tokenHash: sha256(randomToken(8)), // replaced below with the real token hash
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });

    const token = signInviteToken({ sub: invite.id, bid: ctx.businessId });
    await prisma.staffInvite.update({
      where: { id: invite.id },
      data: { tokenHash: sha256(token) },
    });

    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'staff.invite',
      targetType: 'invite',
      targetId: invite.id,
      metadata: { email: input.email, role: input.role },
      ip: clientIp(req),
    });
    logger.info({ email: input.email, businessId: ctx.businessId }, 'Staff invitation created');

    res.status(201).json({
      invite: { id: invite.id, email: invite.email, role: invite.role },
      inviteUrl: `${env.APP_URL}/invite/${token}`,
    });
  }),
);

staffRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const input = parseBody(updateStaffSchema, req);

    const membership = await prisma.staffMembership.findFirst({
      where: { id: req.params.id!, businessId: ctx.businessId },
    });
    if (!membership) throw notFound('Staff member not found');
    if (membership.role === 'OWNER' && membership.userId === ctx.userId) {
      throw badRequest('You cannot change your own owner access');
    }

    const updated = await prisma.staffMembership.update({
      where: { id: membership.id },
      data: {
        role: input.role,
        permissions: input.permissions,
        locationIds: input.locationIds,
        isActive: input.isActive,
      },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'staff.update',
      targetType: 'staff',
      targetId: membership.id,
      metadata: input as Record<string, unknown>,
      ip: clientIp(req),
    });
    res.json(updated);
  }),
);

staffRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ctx = auth(req);
    const membership = await prisma.staffMembership.findFirst({
      where: { id: req.params.id!, businessId: ctx.businessId },
    });
    if (!membership) throw notFound('Staff member not found');
    if (membership.role === 'OWNER') throw badRequest('The owner account cannot be removed');

    await prisma.staffMembership.update({
      where: { id: membership.id },
      data: { isActive: false },
    });
    void recordAudit({
      businessId: ctx.businessId,
      actorUserId: ctx.userId,
      actorLabel: ctx.name,
      action: 'staff.deactivate',
      targetType: 'staff',
      targetId: membership.id,
      ip: clientIp(req),
    });
    res.status(204).end();
  }),
);
