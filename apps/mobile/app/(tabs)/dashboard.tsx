import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import type { DashboardData } from '../../src/lib/types';
import { Card, styles } from '../../src/components/ui';
import { theme } from '../../src/theme';

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint && <Text style={styles.muted}>{hint}</Text>}
    </Card>
  );
}

/** Compact 14-day bar chart drawn with plain views — no chart dependency. */
function MiniChart({ series }: { series: DashboardData['series'] }) {
  const recent = series.slice(-14);
  const max = Math.max(...recent.map((p) => p.stamps), 1);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 4 }}>
      {recent.map((point) => (
        <View key={point.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: '100%',
              height: Math.max(3, (point.stamps / max) * 70),
              backgroundColor: theme.colors.coffee,
              borderRadius: 4,
            }}
          />
          <Text style={{ fontSize: 9, color: theme.colors.muted }}>
            {point.date.slice(8, 10)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { business } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setData(await api<DashboardData>('/v1/analytics/dashboard'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Text style={styles.h1}>{business?.name}</Text>

      {data ? (
        <>
          <View style={styles.row}>
            <Stat label="Stamps today" value={data.stats.stampsToday} hint={`${data.stats.stampsWeek} this week`} />
            <Stat label="Customers" value={data.stats.customers} hint={`${data.stats.newCustomers} new this month`} />
          </View>
          <View style={styles.row}>
            <Stat label="Active members" value={data.stats.activeMembers} hint="Last 30 days" />
            <Stat
              label="Rewards redeemed"
              value={data.stats.rewardsRedeemed}
              hint={`${data.stats.rewardsPending} waiting`}
            />
          </View>

          <Card>
            <Text style={styles.h2}>Stamps — last 14 days</Text>
            <MiniChart series={data.series} />
          </Card>

          <Card>
            <Text style={styles.h2}>Segments</Text>
            {Object.entries(data.segments).map(([segment, count]) => (
              <View key={segment} style={styles.spread}>
                <Text style={{ color: theme.colors.ink }}>
                  {segment.replace('_', ' ').toLowerCase()}
                </Text>
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{count}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <Card>
          <Text style={styles.muted}>Loading your numbers…</Text>
        </Card>
      )}
    </ScrollView>
  );
}
