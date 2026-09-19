import { prisma } from '../src/lib/prisma.js';
import { hashPassword, randomCode, slugify } from '../src/lib/crypto.js';

let counter = 0;

export async function createBusiness(name = 'Test Cafe') {
  counter += 1;
  const business = await prisma.business.create({
    data: { name, slug: `${slugify(name)}-${counter}-${randomCode(4).toLowerCase()}` },
  });
  const program = await prisma.loyaltyProgram.create({
    data: {
      businessId: business.id,
      name: 'Stamps',
      stampsRequired: 10,
      rewardName: 'Free coffee',
      selfServiceCooldownSeconds: 900,
    },
  });
  const location = await prisma.location.create({
    data: { businessId: business.id, name: 'Main' },
  });
  return { business, program, location };
}

export async function createOwner(businessId: string, email?: string) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: email ?? `owner${counter}@example.com`,
      name: 'Owner',
      passwordHash: await hashPassword('SuperSecret123!'),
    },
  });
  const membership = await prisma.staffMembership.create({
    data: { businessId, userId: user.id, role: 'OWNER' },
  });
  return { user, membership };
}

export async function createStaff(businessId: string, email?: string) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: email ?? `staff${counter}@example.com`,
      name: 'Barista',
      passwordHash: await hashPassword('SuperSecret123!'),
    },
  });
  const membership = await prisma.staffMembership.create({
    data: { businessId, userId: user.id, role: 'STAFF' },
  });
  return { user, membership };
}

export async function createMember(businessId: string, programId: string, firstName = 'Maria') {
  counter += 1;
  const customer = await prisma.customer.create({
    data: {
      businessId,
      firstName,
      lastName: 'K.',
      phone: `+3579${String(1000000 + counter).slice(0, 7)}`,
    },
  });
  const membership = await prisma.loyaltyMembership.create({
    data: { businessId, customerId: customer.id, programId, memberCode: randomCode(12) },
  });
  return { customer, membership };
}
