/**
 * Demo data for local development: one café with two locations, staff, NFC tags
 * and a few months of stamping history so the dashboard has something to show.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function code(length: number): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const FIRST = ['Maria', 'Andreas', 'Elena', 'Giorgos', 'Christina', 'Nikos', 'Sofia', 'Petros', 'Anna', 'Kyriakos'];
const LAST = ['Kyriakou', 'Georgiou', 'Christodoulou', 'Ioannou', 'Papadopoulos', 'Demetriou'];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('CoffeeHouse123!', 12);

  const business = await prisma.business.upsert({
    where: { slug: 'coffee-house' },
    update: {},
    create: {
      name: 'Coffee House',
      slug: 'coffee-house',
      primaryColor: '#6F4E37',
      secondaryColor: '#F5E9DA',
      contactEmail: 'hello@coffeehouse.cy',
      contactPhone: '+35722123456',
      addressLine: 'Makariou Avenue 12',
      city: 'Nicosia',
      country: 'CY',
      currency: 'EUR',
      timezone: 'Asia/Nicosia',
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@coffeehouse.cy' },
    update: {},
    create: { email: 'owner@coffeehouse.cy', name: 'Andreas Papadopoulos', passwordHash },
  });
  await prisma.staffMembership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: owner.id } },
    update: { role: 'OWNER' },
    create: { businessId: business.id, userId: owner.id, role: 'OWNER' },
  });

  const barista = await prisma.user.upsert({
    where: { email: 'barista@coffeehouse.cy' },
    update: {},
    create: { email: 'barista@coffeehouse.cy', name: 'Elena Georgiou', passwordHash },
  });
  await prisma.staffMembership.upsert({
    where: { businessId_userId: { businessId: business.id, userId: barista.id } },
    update: { role: 'STAFF' },
    create: { businessId: business.id, userId: barista.id, role: 'STAFF' },
  });

  const locations = [];
  for (const name of ['Nicosia', 'Strovolos', 'Lakatamia']) {
    const existing = await prisma.location.findFirst({ where: { businessId: business.id, name } });
    locations.push(
      existing ??
        (await prisma.location.create({
          data: { businessId: business.id, name, city: name, timezone: 'Asia/Nicosia' },
        })),
    );
  }

  let program = await prisma.loyaltyProgram.findFirst({ where: { businessId: business.id } });
  program ??= await prisma.loyaltyProgram.create({
    data: {
      businessId: business.id,
      name: 'Coffee Loyalty',
      description: 'Collect 10 stamps and get a free coffee.',
      stampsRequired: 10,
      rewardName: 'Free coffee',
      rewardDescription: 'Any coffee of your choice, on us.',
      rewardExpiryDays: 90,
    },
  });

  const rewardExists = await prisma.reward.findFirst({ where: { businessId: business.id } });
  if (!rewardExists) {
    await prisma.reward.createMany({
      data: [
        {
          businessId: business.id,
          programId: program.id,
          name: 'Free coffee',
          description: 'Any coffee of your choice.',
          stampsRequired: 10,
          expiryDays: 90,
        },
        {
          businessId: business.id,
          programId: program.id,
          name: 'Free pastry',
          description: 'A croissant or a bougatsa.',
          stampsRequired: 10,
          isActive: false,
        },
      ],
    });
  }

  for (const [index, location] of locations.entries()) {
    const label = `Counter stamp ${location.name}`;
    const existing = await prisma.nfcDevice.findFirst({ where: { businessId: business.id, label } });
    if (!existing) {
      await prisma.nfcDevice.create({
        data: {
          businessId: business.id,
          locationId: location.id,
          label,
          code: `TAG${index + 1}${code(5)}`,
          secretHash: crypto.createHash('sha256').update(code(24)).digest('hex'),
        },
      });
    }
  }

  const customerCount = await prisma.customer.count({ where: { businessId: business.id } });
  if (customerCount === 0) {
    for (let i = 0; i < 40; i += 1) {
      const firstName = FIRST[i % FIRST.length]!;
      const lastName = LAST[i % LAST.length]!;
      const joinedDaysAgo = Math.floor(Math.random() * 120);
      const joinedAt = new Date(Date.now() - joinedDaysAgo * 86_400_000);

      const customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          firstName,
          lastName,
          phone: `+3579${String(1000000 + i).slice(0, 7)}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
          marketingConsent: i % 3 !== 0,
          locationId: locations[i % locations.length]!.id,
          createdAt: joinedAt,
        },
      });

      const membership = await prisma.loyaltyMembership.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          programId: program.id,
          memberCode: code(12),
          joinedAt,
        },
      });

      await prisma.transaction.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          membershipId: membership.id,
          locationId: locations[i % locations.length]!.id,
          type: 'JOIN',
          channel: 'QR',
          amount: 0,
          balanceAfter: 0,
          createdAt: joinedAt,
        },
      });

      // Spread visits between the join date and today.
      const visits = Math.floor(Math.random() * 18);
      let balance = 0;
      let total = 0;
      let last: Date | null = null;
      for (let v = 0; v < visits; v += 1) {
        const at = new Date(joinedAt.getTime() + Math.random() * (Date.now() - joinedAt.getTime()));
        balance += 1;
        total += 1;
        last = !last || at > last ? at : last;
        await prisma.transaction.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            membershipId: membership.id,
            locationId: locations[i % locations.length]!.id,
            staffUserId: barista.id,
            type: 'STAMP_ADD',
            channel: v % 4 === 0 ? 'NFC' : 'STAFF_APP',
            amount: 1,
            balanceAfter: balance,
            createdAt: at,
          },
        });

        if (balance >= program.stampsRequired) {
          balance -= program.stampsRequired;
          await prisma.rewardRedemption.create({
            data: {
              businessId: business.id,
              customerId: customer.id,
              membershipId: membership.id,
              locationId: locations[i % locations.length]!.id,
              staffUserId: barista.id,
              stampsSpent: program.stampsRequired,
              earnedAt: at,
              redeemedAt: at,
            },
          });
          await prisma.transaction.create({
            data: {
              businessId: business.id,
              customerId: customer.id,
              membershipId: membership.id,
              type: 'REWARD_REDEEMED',
              channel: 'STAFF_APP',
              amount: program.stampsRequired,
              balanceAfter: balance,
              createdAt: at,
            },
          });
        }
      }

      await prisma.loyaltyMembership.update({
        where: { id: membership.id },
        data: {
          stamps: balance,
          totalStamps: total,
          rewardsEarned: Math.floor(total / program.stampsRequired),
          rewardsRedeemed: Math.floor(total / program.stampsRequired),
          lastActivityAt: last,
          lastStampAt: last,
        },
      });
    }
  }

  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      status: 'TRIALING',
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });

  console.log('Seeded Coffee House');
  console.log('  Owner:   owner@coffeehouse.cy / CoffeeHouse123!');
  console.log('  Barista: barista@coffeehouse.cy / CoffeeHouse123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
