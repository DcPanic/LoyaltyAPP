export interface MembershipCard {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  membership: {
    id: string;
    stamps: number;
    stampsRequired: number;
    rewardAvailable: boolean;
    totalStamps: number;
    rewardsRedeemed: number;
    segment: string;
  };
  program: {
    id: string;
    name: string;
    rewardName: string;
    allowedStampAmounts: number[];
  };
  pendingReward: { id: string; name: string; expiresAt: string | null } | null;
}

export interface SearchHit {
  membershipId: string;
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  stamps: number;
  stampsRequired: number;
  rewardAvailable: boolean;
  memberCode: string;
}

export interface RecentItem {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  channel: string;
  createdAt: string;
  customerName: string;
}

export interface DashboardData {
  stats: {
    customers: number;
    activeMembers: number;
    stampsToday: number;
    stampsWeek: number;
    stampsMonth: number;
    newCustomers: number;
    returningCustomers: number;
    rewardsRedeemed: number;
    rewardsPending: number;
  };
  series: { date: string; stamps: number; joins: number; redemptions: number }[];
  segments: Record<string, number>;
}
