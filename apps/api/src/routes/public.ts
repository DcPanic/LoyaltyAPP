import { Router } from 'express';
import { z } from 'zod';
import { joinSchema } from '@loyaltyapp/shared';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, clientIp, parseBody } from '../lib/http.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { sha256 } from '../lib/crypto.js';
import { signMemberToken, verifyMemberToken } from '../lib/tokens.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { activeProgram, joinLoyaltyProgram } from '../services/customers.js';
import { loadMembership, summarise, tapStampOrRedeem } from '../services/loyalty.js';
import { ensurePass, walletAvailability } from '../wallet/index.js';

export const publicRouter: Router = Router();
publicRouter.use(publicLimiter);

function branding(business: {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  addressLine: string | null;
  city: string | null;
  contactPhone: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
}) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logoUrl: business.logoUrl,
    coverImageUrl: business.coverImageUrl,
    primaryColor: business.primaryColor,
    secondaryColor: business.secondaryColor,
    addressLine: business.addressLine,
    city: business.city,
    contactPhone: business.contactPhone,
    privacyPolicyUrl: business.privacyPolicyUrl,
    termsUrl: business.termsUrl,
  };
}

function walletLinks(membershipId: string, memberToken: string) {
  const availability = walletAvailability();
  return {
    apple: availability.apple
      ? `${env.API_URL}/v1/wallet/apple/download/${membershipId}?t=${encodeURIComponent(memberToken)}`
      : null,
    google: availability.google
      ? `${env.API_URL}/v1/wallet/google/save/${membershipId}?redirect=1&t=${encodeURIComponent(memberToken)}`
      : null,
  };
}

/** Branding + program for the café's public join page. */
publicRouter.get(
  '/business/:slug',
  asyncHandler(async (req, res) => {
    const business = await prisma.business.findUnique({ where: { slug: req.params.slug! } });
    if (!business) throw notFound('Café not found');
    const program = await activeProgram(business.id);
    res.json({
      business: branding(business),
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        stampsRequired: program.stampsRequired,
        rewardName: program.rewardName,
        rewardDescription: program.rewardDescription,
        rewardImageUrl: program.rewardImageUrl,
      },
      wallet: walletAvailability(),
    });
  }),
);

/** Join: no app download, straight to a wallet pass. */
publicRouter.post(
  '/join/:slug',
  asyncHandler(async (req, res) => {
    const business = await prisma.business.findUnique({ where: { slug: req.params.slug! } });
    if (!business) throw notFound('Café not found');
    const input = parseBody(joinSchema, req);

    const result = await joinLoyaltyProgram({
      businessId: business.id,
      programId: input.programId,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      birthday: input.birthday ?? null,
      marketingConsent: input.marketingConsent ?? false,
      locationId: input.locationId ?? null,
      source: 'join_page',
      ip: clientIp(req),
    });

    const availability = walletAvailability();
    if (availability.apple) await ensurePass(result.membership.id, 'APPLE');
    if (availability.google) await ensurePass(result.membership.id, 'GOOGLE');

    res.status(201).json({
      membershipId: result.membership.id,
      memberCode: result.membership.memberCode,
      memberToken: result.memberToken,
      memberPageUrl: `${env.APP_URL}/m/${result.membership.memberCode}`,
      rejoined: result.rejoined,
      business: branding(business),
      wallet: walletLinks(result.membership.id, result.memberToken),
      membership: await summarise({ ...result.membership, program: result.program }),
    });
  }),
);

/** The customer's own web card (works without any app). */
publicRouter.get(
  '/member/:memberCode',
  asyncHandler(async (req, res) => {
    const membership = await prisma.loyaltyMembership.findUnique({
      where: { memberCode: req.params.memberCode!.toUpperCase() },
      include: { program: true, customer: true, business: true },
    });
    if (!membership || membership.status === 'DELETED') throw notFound('Loyalty card not found');

    const memberToken = signMemberToken({
      sub: membership.customerId,
      bid: membership.businessId,
      mem: membership.id,
    });

    res.json({
      business: branding(membership.business),
      program: {
        name: membership.program.name,
        stampsRequired: membership.program.stampsRequired,
        rewardName: membership.program.rewardName,
        rewardDescription: membership.program.rewardDescription,
      },
      customer: { firstName: membership.customer.firstName },
      membership: await summarise(membership),
      memberCode: membership.memberCode,
      memberToken,
      wallet: walletLinks(membership.id, memberToken),
    });
  }),
);

/** NFC tag / QR sticker landing: who is this tag and is it usable? */
publicRouter.get(
  '/tag/:code',
  asyncHandler(async (req, res) => {
    const device = await prisma.nfcDevice.findUnique({
      where: { code: req.params.code!.toUpperCase() },
      include: { business: true, location: true },
    });
    if (!device) throw notFound('This tag is not registered');
    if (!device.isActive) throw forbidden('This tag has been disabled');

    const program = await activeProgram(device.businessId);
    res.json({
      business: branding(device.business),
      location: device.location ? { id: device.location.id, name: device.location.name } : null,
      program: {
        id: program.id,
        name: program.name,
        stampsRequired: program.stampsRequired,
        rewardName: program.rewardName,
      },
      joinUrl: `${env.APP_URL}/j/${device.business.slug}`,
    });
  }),
);

const tapSchema = z.object({
  memberToken: z.string().min(20).max(1000),
  /** Client-supplied so a retry of the same tap cannot stamp twice. */
  requestId: z.string().min(8).max(64).optional(),
});

/**
 * NFC tap (or QR fallback) stamping.
 *
 * The tag identifies the café and never the customer; the customer is identified
 * by their signed member token, which lives in a cookie on the web flow. Every
 * request is validated server-side: tag active, tag tenant == member tenant,
 * program cooldown, and idempotency on a short time bucket.
 */
publicRouter.post(
  '/tap/:code',
  asyncHandler(async (req, res) => {
    const input = parseBody(tapSchema, req);
    const device = await prisma.nfcDevice.findUnique({
      where: { code: req.params.code!.toUpperCase() },
    });
    if (!device) throw notFound('This tag is not registered');
    if (!device.isActive) throw forbidden('This tag has been disabled');

    const claims = verifyMemberToken(input.memberToken);
    if (claims.bid !== device.businessId) {
      throw forbidden('This loyalty card belongs to a different café');
    }

    const membership = await loadMembership(device.businessId, claims.mem);
    if (membership.customerId !== claims.sub) throw forbidden('Invalid member token');

    // Without an explicit requestId, collapse repeat taps inside a 30s bucket.
    const bucket = Math.floor(Date.now() / 30_000);
    const key =
      input.requestId ?? sha256(`${device.id}:${membership.id}:${bucket}`).slice(0, 48);

    const result = await tapStampOrRedeem({
      businessId: device.businessId,
      membershipId: membership.id,
      amount: 1,
      channel: 'NFC',
      locationId: device.locationId,
      nfcDeviceId: device.id,
      actorLabel: `NFC tag ${device.label}`,
      idempotencyKey: key,
      ip: clientIp(req),
    });

    await prisma.nfcDevice.update({
      where: { id: device.id },
      data: { lastActivityAt: new Date(), tapCount: { increment: 1 } },
    });

    res.json({
      ...result,
      customerFirstName: membership.customer.firstName,
      rewardName: membership.program.rewardName,
    });
  }),
);

/** QR fallback uses the same engine but is recorded as its own channel. */
publicRouter.post(
  '/tap/:code/qr',
  asyncHandler(async (req, res) => {
    const input = parseBody(tapSchema, req);
    const device = await prisma.nfcDevice.findUnique({
      where: { code: req.params.code!.toUpperCase() },
    });
    if (!device || !device.isActive) throw notFound('This tag is not available');

    const claims = verifyMemberToken(input.memberToken);
    if (claims.bid !== device.businessId) throw forbidden('This card belongs to a different café');
    const membership = await loadMembership(device.businessId, claims.mem);

    const bucket = Math.floor(Date.now() / 30_000);
    const result = await tapStampOrRedeem({
      businessId: device.businessId,
      membershipId: membership.id,
      amount: 1,
      channel: 'QR',
      locationId: device.locationId,
      nfcDeviceId: device.id,
      actorLabel: `QR tag ${device.label}`,
      idempotencyKey:
        input.requestId ?? sha256(`${device.id}:${membership.id}:qr:${bucket}`).slice(0, 48),
      ip: clientIp(req),
    });
    res.json(result);
  }),
);

/** Customer self-service: withdraw marketing consent without an account. */
publicRouter.post(
  '/member/:memberCode/consent',
  asyncHandler(async (req, res) => {
    const { granted, memberToken } = parseBody(
      z.object({ granted: z.boolean(), memberToken: z.string().min(20) }),
      req,
    );
    const claims = verifyMemberToken(memberToken);
    const membership = await prisma.loyaltyMembership.findUnique({
      where: { memberCode: req.params.memberCode!.toUpperCase() },
    });
    if (!membership || membership.id !== claims.mem) throw badRequest('Invalid member token');

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: membership.customerId },
        data: { marketingConsent: granted },
      }),
      prisma.consentRecord.create({
        data: {
          businessId: membership.businessId,
          customerId: membership.customerId,
          granted,
          source: 'member_page',
          ip: clientIp(req) ?? null,
        },
      }),
    ]);
    res.status(204).end();
  }),
);
