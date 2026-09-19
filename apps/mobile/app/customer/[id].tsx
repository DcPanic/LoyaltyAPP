import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/lib/api';
import { Card, StampRow, styles } from '../../src/components/ui';
import { theme } from '../../src/theme';

interface Profile {
  customer: {
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    marketingConsent: boolean;
    createdAt: string;
  };
  memberships: {
    id: string;
    memberCode: string;
    stamps: number;
    totalStamps: number;
    rewardsRedeemed: number;
    segment: string;
    rewardAvailable: boolean;
    program: { name: string; stampsRequired: number; rewardName: string };
  }[];
  transactions: {
    id: string;
    type: string;
    channel: string;
    amount: number;
    balanceAfter: number;
    createdAt: string;
  }[];
}

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      void api<Profile>(`/v1/customers/${id}`).then(setProfile);
    }, [id]),
  );

  if (!profile) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Card>
          <Text style={styles.muted}>Loading…</Text>
        </Card>
      </View>
    );
  }

  const membership = profile.memberships[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.h2}>
          {profile.customer.firstName} {profile.customer.lastName ?? ''}
        </Text>
        <Text style={styles.muted}>{profile.customer.phone ?? profile.customer.email ?? '—'}</Text>
        <Text style={styles.muted}>
          Member since {new Date(profile.customer.createdAt).toLocaleDateString()}
        </Text>
      </Card>

      {membership && (
        <Card>
          <Text style={styles.h2}>{membership.program.name}</Text>
          <StampRow stamps={membership.stamps} required={membership.program.stampsRequired} />
          <Text style={styles.muted}>
            {membership.stamps} / {membership.program.stampsRequired} · {membership.totalStamps}{' '}
            all-time · {membership.rewardsRedeemed} rewards
          </Text>
          <Text style={styles.muted}>Member code: {membership.memberCode}</Text>
        </Card>
      )}

      <Card>
        <Text style={styles.h2}>Activity</Text>
        {profile.transactions.slice(0, 25).map((t) => (
          <View key={t.id} style={styles.spread}>
            <View>
              <Text style={{ color: theme.colors.ink }}>
                {t.type.replace('_', ' ').toLowerCase()}
              </Text>
              <Text style={styles.muted}>
                {new Date(t.createdAt).toLocaleString()} · {t.channel.toLowerCase()}
              </Text>
            </View>
            <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{t.balanceAfter}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
