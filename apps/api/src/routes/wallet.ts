import { Router } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/http.js';
import { timingSafeEqual } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyMemberToken } from '../lib/tokens.js';
import {
  buildApplePass,
  buildGoogleSaveUrl,
  passContext,
  walletAvailability,
} from '../wallet/index.js';
import { buildPkPass } from '../wallet/apple/pass.js';

export const walletRouter: Router = Router();

/**
 * Apple Wallet pass web service (PassKit Web Service spec).
 * Mounted at /v1/wallet/apple, which is the webServiceURL inside every pass.
 */
const apple = Router({ mergeParams: true });

async function authorisePass(
  authHeader: string | undefined,
  serialNumber: string,
  passTypeIdentifier: string,
) {
  if (passTypeIdentifier !== env.APPLE_PASS_TYPE_IDENTIFIER) return null;
  if (!authHeader?.startsWith('ApplePass ')) return null;
  const token = authHeader.slice('ApplePass '.length).trim();

  const pass = await prisma.walletPass.findUnique({ where: { serialNumber } });
  if (!pass || pass.platform !== 'APPLE' || pass.revokedAt || !pass.authToken) return null;
  if (!timingSafeEqual(pass.authToken, token)) return null;
  return pass;
}

// Register a device to receive push updates for a pass.
apple.post(
  '/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber',
  asyncHandler(async (req, res) => {
    const { deviceLibraryId, passTypeId, serialNumber } = req.params as unknown as {
      deviceLibraryId: string;
      passTypeId: string;
      serialNumber: string;
    };
    const pass = await authorisePass(req.headers.authorization, serialNumber, passTypeId);
    if (!pass) return res.status(401).end();

    const pushToken = (req.body as { pushToken?: string })?.pushToken;
    if (!pushToken) return res.status(400).end();

    const existing = await prisma.walletDeviceRegistration.findUnique({
      where: { passId_deviceLibraryId: { passId: pass.id, deviceLibraryId } },
    });
    if (existing) {
      if (existing.pushToken !== pushToken) {
        await prisma.walletDeviceRegistration.update({
          where: { id: existing.id },
          data: { pushToken },
        });
      }
      return res.status(200).end();
    }

    await prisma.walletDeviceRegistration.create({
      data: { passId: pass.id, deviceLibraryId, pushToken, passTypeIdentifier: passTypeId },
    });
    return res.status(201).end();
  }),
);

// Serial numbers changed since a tag — how a device learns what to refresh.
apple.get(
  '/v1/devices/:deviceLibraryId/registrations/:passTypeId',
  asyncHandler(async (req, res) => {
    const { deviceLibraryId, passTypeId } = req.params as unknown as {
      deviceLibraryId: string;
      passTypeId: string;
    };
    if (passTypeId !== env.APPLE_PASS_TYPE_IDENTIFIER) return res.status(404).end();
    const since = req.query.passesUpdatedSince as string | undefined;
    const sinceDate = since ? new Date(since) : null;

    const registrations = await prisma.walletDeviceRegistration.findMany({
      where: {
        deviceLibraryId,
        passTypeIdentifier: passTypeId,
        pass: {
          revokedAt: null,
          ...(sinceDate && !Number.isNaN(sinceDate.getTime())
            ? { updatedTag: { gt: sinceDate } }
            : {}),
        },
      },
      include: { pass: true },
    });
    if (registrations.length === 0) return res.status(204).end();

    const lastUpdated = registrations
      .map((r) => r.pass.updatedTag)
      .reduce((a, b) => (a > b ? a : b))
      .toISOString();

    return res.json({
      serialNumbers: registrations.map((r) => r.pass.serialNumber),
      lastUpdated,
    });
  }),
);

// Latest version of a pass, rebuilt from the database.
apple.get(
  '/v1/passes/:passTypeId/:serialNumber',
  asyncHandler(async (req, res) => {
    const { passTypeId, serialNumber } = req.params as unknown as {
      passTypeId: string;
      serialNumber: string;
    };
    const pass = await authorisePass(req.headers.authorization, serialNumber, passTypeId);
    if (!pass) return res.status(401).end();

    const membership = await prisma.loyaltyMembership.findUnique({
      where: { id: pass.membershipId },
      include: { program: true, customer: true, business: true },
    });
    if (!membership) return res.status(404).end();

    const body = await buildPkPass(passContext(membership, pass));
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Last-Modified', pass.updatedTag.toUTCString());
    return res.send(body);
  }),
);

// Device removed the pass.
apple.delete(
  '/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber',
  asyncHandler(async (req, res) => {
    const { deviceLibraryId, passTypeId, serialNumber } = req.params as unknown as {
      deviceLibraryId: string;
      passTypeId: string;
      serialNumber: string;
    };
    const pass = await authorisePass(req.headers.authorization, serialNumber, passTypeId);
    if (!pass) return res.status(401).end();

    await prisma.walletDeviceRegistration.deleteMany({
      where: { passId: pass.id, deviceLibraryId },
    });
    return res.status(200).end();
  }),
);

apple.post(
  '/v1/log',
  asyncHandler(async (req, res) => {
    logger.info({ logs: (req.body as { logs?: string[] })?.logs }, 'Apple Wallet device log');
    res.status(200).end();
  }),
);

walletRouter.use('/apple', apple);

/** Member-token guard: only the customer who joined can pull their own pass. */
function assertMemberToken(token: unknown, membershipId: string): void {
  if (typeof token !== 'string' || token.length === 0) throw unauthorized('Missing member token');
  const claims = verifyMemberToken(token);
  if (claims.mem !== membershipId) throw forbidden('This token is for a different loyalty card');
}

/** Direct download used by the join page's "Add to Apple Wallet" button. */
walletRouter.get(
  '/apple/download/:membershipId',
  asyncHandler(async (req, res) => {
    const membershipId = String(req.params.membershipId);
    assertMemberToken(req.query.t, membershipId);
    const { body, filename } = await buildApplePass(membershipId);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }),
);

/** "Add to Google Wallet" — returns the signed save link for this membership. */
walletRouter.get(
  '/google/save/:membershipId',
  asyncHandler(async (req, res) => {
    const membershipId = String(req.params.membershipId);
    assertMemberToken(req.query.t, membershipId);
    const url = await buildGoogleSaveUrl(membershipId);
    if (req.query.redirect === '1') return res.redirect(302, url);
    return res.json({ url });
  }),
);

walletRouter.get(
  '/availability',
  asyncHandler(async (_req, res) => {
    res.json(walletAvailability());
  }),
);
