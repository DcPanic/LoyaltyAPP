export const SEGMENTS = ['NEW', 'ACTIVE', 'VIP', 'AT_RISK', 'LOST'] as const;
export type Segment = (typeof SEGMENTS)[number];

export interface SegmentRules {
  /** A membership joined within this many days is NEW. */
  newWithinDays: number;
  /** Stamps in the VIP window required to be VIP. */
  vipStampsThreshold: number;
  vipWindowDays: number;
  /** No activity for this many days => AT_RISK. */
  atRiskAfterDays: number;
  /** No activity for this many days => LOST. */
  lostAfterDays: number;
}

export const DEFAULT_SEGMENT_RULES: SegmentRules = {
  newWithinDays: 14,
  vipStampsThreshold: 20,
  vipWindowDays: 60,
  atRiskAfterDays: 30,
  lostAfterDays: 90,
};

export interface SegmentInput {
  joinedAt: Date;
  lastActivityAt: Date | null;
  stampsInVipWindow: number;
}

/**
 * Pure classifier so API, web and mobile all agree on what a segment means.
 * Order matters: LOST and AT_RISK win over VIP, NEW wins over ACTIVE.
 */
export function classifySegment(
  input: SegmentInput,
  rules: SegmentRules = DEFAULT_SEGMENT_RULES,
  now: Date = new Date(),
): Segment {
  const days = (from: Date) => (now.getTime() - from.getTime()) / 86_400_000;
  const inactiveDays = days(input.lastActivityAt ?? input.joinedAt);

  if (inactiveDays >= rules.lostAfterDays) return 'LOST';
  if (inactiveDays >= rules.atRiskAfterDays) return 'AT_RISK';
  if (days(input.joinedAt) <= rules.newWithinDays) return 'NEW';
  if (input.stampsInVipWindow >= rules.vipStampsThreshold) return 'VIP';
  return 'ACTIVE';
}
