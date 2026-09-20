import type { Role, Permission } from './roles.js';
import type { Segment } from './segments.js';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  businessId: string;
  role: Role;
  permissions: Permission[];
  locationIds: string[];
}

export interface BusinessBranding {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
}

export interface MembershipSummary {
  id: string;
  customerId: string;
  programId: string;
  stamps: number;
  stampsRequired: number;
  totalStamps: number;
  rewardsEarned: number;
  rewardsRedeemed: number;
  rewardAvailable: boolean;
  joinedAt: string;
  lastActivityAt: string | null;
  segment: Segment;
}

export interface StampResult {
  membership: MembershipSummary;
  transactionId: string;
  stampsAdded: number;
  rewardUnlocked: boolean;
  duplicate: boolean;
}

/**
 * A self-service tap does one of two things: adds a stamp, or — when the card is
 * already full — hands over the reward and starts the card again. `redeemed`
 * says which happened, so the page the customer is looking at can say so.
 */
export interface TapResult extends StampResult {
  redeemed: boolean;
  rewardName: string | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
