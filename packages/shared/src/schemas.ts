import { z } from 'zod';
import { ROLES } from './roles.js';
import { SEGMENTS } from './segments.js';

export const emailSchema = z.string().trim().toLowerCase().email().max(320);
export const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(32)
  .regex(/^\+?[0-9 ()-]+$/, 'Invalid phone number');
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200);
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #6F4E37');
export const cuidLike = z.string().min(8).max(64);

/* ---------------------------------------------------------------- auth ---- */

export const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  country: z.string().trim().length(2).toUpperCase().default('CY'),
  currency: z.string().trim().length(3).toUpperCase().default('EUR'),
  timezone: z.string().trim().min(3).max(64).default('Asia/Nicosia'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(500) });

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(500),
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
});

/* ------------------------------------------------------------ business ---- */

export const openingHoursSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      closed: z.boolean().default(false),
    }),
  )
  .max(14);

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().url().max(2048).nullish(),
  coverImageUrl: z.string().url().max(2048).nullish(),
  primaryColor: colorSchema.optional(),
  secondaryColor: colorSchema.optional(),
  contactEmail: emailSchema.nullish(),
  contactPhone: phoneSchema.nullish(),
  addressLine: z.string().trim().max(240).nullish(),
  city: z.string().trim().max(120).nullish(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  openingHours: openingHoursSchema.nullish(),
  privacyPolicyUrl: z.string().url().max(2048).nullish(),
  termsUrl: z.string().url().max(2048).nullish(),
});

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().max(240).nullish(),
  city: z.string().trim().max(120).nullish(),
  phone: phoneSchema.nullish(),
  timezone: z.string().trim().min(3).max(64).optional(),
  isActive: z.boolean().optional(),
});

/* ------------------------------------------------------------- loyalty ---- */

export const loyaltyProgramSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullish(),
  stampsRequired: z.number().int().min(1).max(100),
  rewardName: z.string().trim().min(2).max(120),
  rewardDescription: z.string().trim().max(1000).nullish(),
  rewardImageUrl: z.string().url().max(2048).nullish(),
  rewardExpiryDays: z.number().int().min(1).max(3650).nullish(),
  allowedStampAmounts: z.array(z.number().int().min(1).max(50)).min(1).max(10).optional(),
  maxStampsPerVisit: z.number().int().min(1).max(50).optional(),
  /** Minimum seconds between two self-service (NFC/QR) stamps for one member. */
  selfServiceCooldownSeconds: z.number().int().min(0).max(86_400).optional(),
  shareAcrossLocations: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const rewardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullish(),
  imageUrl: z.string().url().max(2048).nullish(),
  stampsRequired: z.number().int().min(1).max(100),
  expiryDays: z.number().int().min(1).max(3650).nullish(),
  isActive: z.boolean().optional(),
});

/* ------------------------------------------------------------ customer ---- */

export const customerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).nullish(),
  phone: phoneSchema.nullish(),
  email: emailSchema.nullish(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  marketingConsent: z.boolean().default(false),
  locationId: cuidLike.nullish(),
});

export const joinSchema = customerSchema
  .extend({
    programId: cuidLike.optional(),
    termsAccepted: z.literal(true),
  })
  .refine((v) => Boolean(v.phone || v.email), {
    message: 'A phone number or an email address is required',
    path: ['phone'],
  });

export const customerSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  segment: z.enum(SEGMENTS).optional(),
  locationId: cuidLike.optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/* ------------------------------------------------------------ stamping ---- */

export const stampSchema = z.object({
  membershipId: cuidLike.optional(),
  memberToken: z.string().min(10).max(500).optional(),
  customerId: cuidLike.optional(),
  amount: z.number().int().min(1).max(50).default(1),
  locationId: cuidLike.nullish(),
  note: z.string().trim().max(240).nullish(),
  channel: z.enum(['STAFF_APP', 'STAFF_WEB', 'PHONE_ORDER', 'DELIVERY', 'NFC', 'QR']).default('STAFF_APP'),
});

export const redeemSchema = z.object({
  membershipId: cuidLike,
  rewardId: cuidLike.optional(),
  locationId: cuidLike.nullish(),
  note: z.string().trim().max(240).nullish(),
});

export const adjustSchema = z.object({
  membershipId: cuidLike,
  stamps: z.number().int().min(0).max(1000),
  reason: z.string().trim().min(3).max(240),
});

/* --------------------------------------------------------------- staff ---- */

export const inviteStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  role: z.enum(ROLES).default('STAFF'),
  locationIds: z.array(cuidLike).max(50).default([]),
  permissions: z.array(z.string().max(40)).max(40).optional(),
});

export const updateStaffSchema = z.object({
  role: z.enum(ROLES).optional(),
  locationIds: z.array(cuidLike).max(50).optional(),
  permissions: z.array(z.string().max(40)).max(40).optional(),
  isActive: z.boolean().optional(),
});

/* ----------------------------------------------------------------- nfc ---- */

export const nfcDeviceSchema = z.object({
  label: z.string().trim().min(2).max(120),
  locationId: cuidLike.nullish(),
});

export const updateNfcDeviceSchema = nfcDeviceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/* ----------------------------------------------------------- campaigns ---- */

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['DOUBLE_STAMP', 'BIRTHDAY', 'WIN_BACK', 'VIP_OFFER', 'ANNOUNCEMENT']),
  message: z.string().trim().min(3).max(300),
  segments: z.array(z.enum(SEGMENTS)).max(5).default([]),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  /** DOUBLE_STAMP only: stamps are multiplied by this while the campaign runs. */
  stampMultiplier: z.number().int().min(1).max(5).optional(),
  isActive: z.boolean().optional(),
});

/* ------------------------------------------------------------ privacy ----- */

export const consentSchema = z.object({
  marketingConsent: z.boolean(),
  source: z.string().trim().max(60).default('dashboard'),
});
