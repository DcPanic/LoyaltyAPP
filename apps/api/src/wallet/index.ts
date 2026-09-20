import { env, appleWalletConfigured, googleWalletConfigured } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { notFound, notConfigured } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { randomToken } from '../lib/crypto.js';
import { buildPkPass, type PassContext } from './apple/pass.js';
import { pushPassUpdate } from './apple/apns.js';
import {
  expireLoyaltyObject,
  saveLink,
  upsertLoyaltyClass,
  upsertLoyaltyObject,
} from './google/client.js';

export interface WalletAvailability {
  apple: boolean;
  google: boolean;
}

export const walletAvailability = (): WalletAvailability => ({
  apple: appleWalletConfigured,
  google: googleWalletConfigured,
});

async function loadContext(membershipId: string) {
  const membership = await prisma.loyaltyMembership.findUnique({
    where: { id: membershipId },
    include: { program: true, customer: true, business: true },
  });
  if (!membership) throw notFound('Loyalty membership not found');
  return membership;
}

type MembershipWithRelations = Awaited<ReturnType<typeof loadContext>>;

function passContext(
  m: MembershipWithRelations,
  pass: { serialNumber: string; authToken: string | null; updatedTag: Date },
): PassContext {
  const customerName = [m.customer.firstName, m.customer.lastName].filter(Boolean).join(' ');
  return {
    serialNumber: pass.serialNumber,
    authToken: pass.authToken ?? '',
    businessName: m.business.name,
    programName: m.program.name,
    rewardName: m.program.rewardName,
    rewardDescription: m.program.rewardDescription,
    stamps: m.stamps,
    stampsRequired: m.program.stampsRequired,
    rewardAvailable: m.stamps >= m.program.stampsRequired,
    customerName,
    memberCode: m.memberCode,
    primaryColor: m.business.primaryColor,
    secondaryColor: m.business.secondaryColor,
    logoUrl: m.business.logoUrl,
    rewardImageUrl: m.program.rewardImageUrl,
    contactPhone: m.business.contactPhone,
    addressLine: [m.business.addressLine, m.business.city].filter(Boolean).join(', ') || null,
    privacyPolicyUrl: m.business.privacyPolicyUrl,
    termsUrl: m.business.termsUrl,
    updatedTag: pass.updatedTag.toISOString(),
  };
}

const googleClassId = (businessId: string, programId: string) =>
  `${env.GOOGLE_WALLET_ISSUER_ID}.${businessId}-${programId}`.slice(0, 120);
const googleObjectId = (memberCode: string) =>
  `${env.GOOGLE_WALLET_ISSUER_ID}.${memberCode}`;

/** Creates the single persistent pass record per platform (never one per stamp). */
export async function ensurePass(membershipId: string, platform: 'APPLE' | 'GOOGLE') {
  const existing = await prisma.walletPass.findUnique({
    where: { membershipId_platform: { membershipId, platform } },
  });
  if (existing && !existing.revokedAt) return existing;

  const m = await loadContext(membershipId);
  return prisma.walletPass.create({
    data: {
      businessId: m.businessId,
      membershipId,
      platform,
      serialNumber: platform === 'APPLE' ? m.memberCode : `${m.memberCode}-G`,
      authToken: platform === 'APPLE' ? randomToken(24) : null,
      externalId: platform === 'GOOGLE' ? googleObjectId(m.memberCode) : null,
      classId: platform === 'GOOGLE' ? googleClassId(m.businessId, m.programId) : null,
    },
  });
}

/** Signed .pkpass for download — built fresh from the database every time. */
export async function buildApplePass(membershipId: string): Promise<{ body: Buffer; filename: string }> {
  if (!appleWalletConfigured) throw notConfigured('Apple Wallet is not configured');
  const pass = await ensurePass(membershipId, 'APPLE');
  const m = await loadContext(membershipId);
  const body = await buildPkPass(passContext(m, pass));
  return { body, filename: `${m.business.slug}-loyalty.pkpass` };
}

/** "Add to Google Wallet" URL — creates/updates the object, then signs a save JWT. */
export async function buildGoogleSaveUrl(membershipId: string): Promise<string> {
  if (!googleWalletConfigured) throw notConfigured('Google Wallet is not configured');
  const pass = await ensurePass(membershipId, 'GOOGLE');
  const m = await loadContext(membershipId);
  const classId = pass.classId ?? googleClassId(m.businessId, m.programId);
  const objectId = pass.externalId ?? googleObjectId(m.memberCode);

  await upsertLoyaltyClass({
    classId,
    businessName: m.business.name,
    programName: m.program.name,
    rewardName: m.program.rewardName,
    primaryColor: m.business.primaryColor,
    logoUrl: m.business.logoUrl,
    rewardImageUrl: m.program.rewardImageUrl,
    homepageUrl: `${env.APP_URL}/c/${m.business.slug}`,
  });
  await upsertLoyaltyObject({
    objectId,
    classId,
    customerName: [m.customer.firstName, m.customer.lastName].filter(Boolean).join(' '),
    memberCode: m.memberCode,
    stamps: m.stamps,
    stampsRequired: m.program.stampsRequired,
    rewardAvailable: m.stamps >= m.program.stampsRequired,
    rewardName: m.program.rewardName,
    memberPageUrl: `${env.APP_URL}/m/${m.memberCode}`,
  });

  return saveLink(objectId, classId);
}

/**
 * Pushes the current database state to every wallet pass of a membership.
 * Apple devices are told to re-fetch (APNs); Google objects are patched directly.
 */
export async function syncMembershipPasses(membershipId: string): Promise<void> {
  const passes = await prisma.walletPass.findMany({
    where: { membershipId, revokedAt: null },
    include: { registrations: true },
  });
  if (passes.length === 0) return;

  const m = await loadContext(membershipId);
  await prisma.walletPass.updateMany({
    where: { membershipId, revokedAt: null },
    data: { updatedTag: new Date() },
  });

  for (const pass of passes) {
    if (pass.platform === 'APPLE') {
      if (!appleWalletConfigured) continue;
      for (const registration of pass.registrations) {
        const result = await pushPassUpdate(registration.pushToken);
        if (result.unregister) {
          await prisma.walletDeviceRegistration.delete({ where: { id: registration.id } });
        }
      }
      await prisma.walletPass.update({
        where: { id: pass.id },
        data: { lastPushedAt: new Date() },
      });
    }

    if (pass.platform === 'GOOGLE') {
      if (!googleWalletConfigured || !pass.externalId || !pass.classId) continue;
      try {
        await upsertLoyaltyObject({
          objectId: pass.externalId,
          classId: pass.classId,
          customerName: [m.customer.firstName, m.customer.lastName].filter(Boolean).join(' '),
          memberCode: m.memberCode,
          stamps: m.stamps,
          stampsRequired: m.program.stampsRequired,
          rewardAvailable: m.stamps >= m.program.stampsRequired,
          rewardName: m.program.rewardName,
          memberPageUrl: `${env.APP_URL}/m/${m.memberCode}`,
        });
        await prisma.walletPass.update({
          where: { id: pass.id },
          data: { lastPushedAt: new Date() },
        });
      } catch (err) {
        logger.error({ err, passId: pass.id }, 'Google Wallet object update failed');
      }
    }
  }
}

/** Used when a customer is deleted or a membership is closed (GDPR erasure). */
export async function revokeMembershipPasses(membershipId: string): Promise<void> {
  const passes = await prisma.walletPass.findMany({ where: { membershipId, revokedAt: null } });
  for (const pass of passes) {
    if (pass.platform === 'GOOGLE' && pass.externalId && googleWalletConfigured) {
      await expireLoyaltyObject(pass.externalId).catch(() => undefined);
    }
  }
  await prisma.walletPass.updateMany({
    where: { membershipId },
    data: { revokedAt: new Date() },
  });
  await prisma.walletDeviceRegistration.deleteMany({
    where: { pass: { membershipId } },
  });
}

export { passContext, googleClassId, googleObjectId };
