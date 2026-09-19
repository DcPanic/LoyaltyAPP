import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { addStamps, adjustStamps, redeemReward, removeStamps } from '../src/services/loyalty.js';
import { createBusiness, createMember, createOwner } from './factories.js';

describe('stamp engine', () => {
  let businessId: string;
  let programId: string;
  let ownerId: string;

  beforeAll(async () => {
    const { business, program } = await createBusiness('Stamp Engine Cafe');
    businessId = business.id;
    programId = program.id;
    ownerId = (await createOwner(businessId)).user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('adds stamps and records the transaction', async () => {
    const { membership } = await createMember(businessId, programId);
    const result = await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 3,
      channel: 'STAFF_APP',
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'key-add-1',
    });

    expect(result.membership.stamps).toBe(3);
    expect(result.stampsAdded).toBe(3);
    expect(result.duplicate).toBe(false);

    const transactions = await prisma.transaction.count({
      where: { membershipId: membership.id, type: 'STAMP_ADD' },
    });
    expect(transactions).toBe(1);
  });

  it('is idempotent: the same request twice gives one stamp', async () => {
    const { membership } = await createMember(businessId, programId);
    const cmd = {
      businessId,
      membershipId: membership.id,
      amount: 1,
      channel: 'STAFF_APP' as const,
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'double-tap-key',
    };

    const first = await addStamps(cmd);
    const second = await addStamps(cmd);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.membership.stamps).toBe(1);

    const fresh = await prisma.loyaltyMembership.findUnique({ where: { id: membership.id } });
    expect(fresh?.stamps).toBe(1);
  });

  it('unlocks exactly one reward when the threshold is reached', async () => {
    const { membership } = await createMember(businessId, programId);
    const result = await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 10,
      channel: 'STAFF_APP',
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'reward-key',
    });

    expect(result.rewardUnlocked).toBe(true);
    expect(result.membership.rewardAvailable).toBe(true);

    const pending = await prisma.rewardRedemption.count({
      where: { membershipId: membership.id, redeemedAt: null },
    });
    expect(pending).toBe(1);
  });

  it('redeems a reward and resets the balance by the required amount', async () => {
    const { membership } = await createMember(businessId, programId);
    await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 10,
      channel: 'STAFF_APP',
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'redeem-setup',
    });

    const result = await redeemReward({
      businessId,
      membershipId: membership.id,
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'redeem-key',
    });

    expect(result.membership.stamps).toBe(0);
    expect(result.membership.rewardsRedeemed).toBe(1);

    await expect(
      redeemReward({
        businessId,
        membershipId: membership.id,
        staffUserId: ownerId,
        actorLabel: 'Owner',
        idempotencyKey: 'redeem-key-2',
      }),
    ).rejects.toThrow();
  });

  it('enforces the self-service cooldown for NFC taps', async () => {
    const { membership } = await createMember(businessId, programId);
    await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 1,
      channel: 'NFC',
      actorLabel: 'NFC tag',
      idempotencyKey: 'nfc-1',
    });

    await expect(
      addStamps({
        businessId,
        membershipId: membership.id,
        amount: 1,
        channel: 'NFC',
        actorLabel: 'NFC tag',
        idempotencyKey: 'nfc-2',
      }),
    ).rejects.toThrow(/already stamped recently/i);
  });

  it('still lets staff stamp while the self-service cooldown is active', async () => {
    const { membership } = await createMember(businessId, programId);
    await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 1,
      channel: 'NFC',
      actorLabel: 'NFC tag',
      idempotencyKey: 'nfc-mix-1',
    });

    const staffResult = await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 1,
      channel: 'PHONE_ORDER',
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'phone-order-1',
    });
    expect(staffResult.membership.stamps).toBe(2);
  });

  it('applies an active double stamp campaign', async () => {
    const { business, program } = await createBusiness('Double Stamp Cafe');
    const { membership } = await createMember(business.id, program.id);
    await prisma.campaign.create({
      data: {
        businessId: business.id,
        name: 'Double Stamp Day',
        type: 'DOUBLE_STAMP',
        message: 'Two stamps today',
        stampMultiplier: 2,
        isActive: true,
      },
    });

    const result = await addStamps({
      businessId: business.id,
      membershipId: membership.id,
      amount: 2,
      channel: 'STAFF_APP',
      actorLabel: 'Owner',
      idempotencyKey: 'double-1',
    });
    expect(result.membership.stamps).toBe(4);
  });

  it('removes stamps and records an adjustment with a reason', async () => {
    const { membership } = await createMember(businessId, programId);
    await addStamps({
      businessId,
      membershipId: membership.id,
      amount: 5,
      channel: 'STAFF_APP',
      actorLabel: 'Owner',
      idempotencyKey: 'remove-setup',
    });

    const removed = await removeStamps({
      businessId,
      membershipId: membership.id,
      amount: 2,
      channel: 'STAFF_WEB',
      staffUserId: ownerId,
      actorLabel: 'Owner',
      idempotencyKey: 'remove-1',
    });
    expect(removed.membership.stamps).toBe(3);

    const adjusted = await adjustStamps({
      businessId,
      membershipId: membership.id,
      stamps: 7,
      reason: 'Loyalty card from the old paper system',
      staffUserId: ownerId,
      actorLabel: 'Owner',
    });
    expect(adjusted.stamps).toBe(7);

    const audit = await prisma.auditLog.findFirst({
      where: { businessId, action: 'stamp.adjust', targetId: membership.id },
    });
    expect(audit).not.toBeNull();
  });

  it('refuses to stamp a membership from another business', async () => {
    const other = await createBusiness('Espresso Corner');
    const { membership } = await createMember(other.business.id, other.program.id);

    await expect(
      addStamps({
        businessId,
        membershipId: membership.id,
        amount: 1,
        channel: 'STAFF_APP',
        actorLabel: 'Owner',
        idempotencyKey: 'cross-tenant',
      }),
    ).rejects.toThrow(/not found/i);
  });
});
