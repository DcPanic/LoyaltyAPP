import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '../../src/lib/api';
import { Banner, Card, styles } from '../../src/components/ui';
import { theme } from '../../src/theme';

interface Shift {
  id: string;
  staffMembershipId: string;
  staffName: string;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  note: string | null;
  published: boolean;
}

interface Schedule {
  canManage: boolean;
  scope: 'mine' | 'everyone';
  myMembershipId: string;
  items: Shift[];
}

/** Monday of the week containing `d`, at midnight local time. */
function weekStart(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  return start;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const hours = (from: string, to: string) =>
  Math.round(((new Date(to).getTime() - new Date(from).getTime()) / 3_600_000) * 10) / 10;

/**
 * When the team works.
 *
 * Read-only: the rota is written on the dashboard and this is where it is
 * consulted, usually standing up and in a hurry. Today is called today rather
 * than given a date, because that is the question being asked.
 */
export default function ShiftsScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const from = weekStart(new Date());
  from.setDate(from.getDate() + weekOffset * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(
        await api<Schedule>(
          `/v1/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule');
    }
    // The dates are derived from weekOffset, so that is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(from);
    day.setDate(day.getDate() + i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      date: day,
      name: DAY_NAMES[i]!,
      isToday: new Date().toDateString() === day.toDateString(),
      shifts: (data?.items ?? []).filter((s) => {
        const at = new Date(s.startsAt);
        return at >= day && at < next;
      }),
    };
  });

  const myHours = (data?.items ?? [])
    .filter((s) => s.staffMembershipId === data?.myMembershipId)
    .reduce((total, s) => total + hours(s.startsAt, s.endsAt), 0);

  const label =
    weekOffset === 0
      ? 'This week'
      : weekOffset === 1
        ? 'Next week'
        : weekOffset === -1
          ? 'Last week'
          : `${from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — ${new Date(to.getTime() - 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

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
      {error && <Banner tone="error">{error}</Banner>}

      <Card>
        <View style={styles.spread}>
          <Text
            style={[styles.h2, { color: theme.colors.coffee }]}
            onPress={() => setWeekOffset(weekOffset - 1)}
            accessibilityRole="button"
          >
            ‹
          </Text>
          <Text style={styles.h2}>{label}</Text>
          <Text
            style={[styles.h2, { color: theme.colors.coffee }]}
            onPress={() => setWeekOffset(weekOffset + 1)}
            accessibilityRole="button"
          >
            ›
          </Text>
        </View>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {myHours > 0 ? `${myHours} hours for you` : 'Nothing for you this week'}
          {data?.scope === 'everyone' ? ' · whole team' : ''}
        </Text>
      </Card>

      {days.map((day) => (
        <Card key={day.name} style={day.isToday ? { borderColor: theme.colors.joyMango } : undefined}>
          <View style={styles.spread}>
            <Text style={styles.h2}>{day.isToday ? 'Today' : day.name}</Text>
            <Text style={styles.muted}>
              {day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </Text>
          </View>

          {day.shifts.length === 0 ? (
            <Text style={styles.muted}>Nobody on.</Text>
          ) : (
            day.shifts.map((shift) => {
              const isMine = shift.staffMembershipId === data?.myMembershipId;
              return (
                <View
                  key={shift.id}
                  style={[
                    styles.spread,
                    {
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: theme.radius.sm,
                      backgroundColor: isMine ? theme.colors.joyMangoSoft : theme.colors.cream,
                      borderWidth: isMine ? 1 : 0,
                      borderColor: theme.colors.joyMango,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                      {isMine ? 'You' : shift.staffName}
                    </Text>
                    {(shift.locationName || shift.note) && (
                      <Text style={styles.muted}>
                        {[shift.locationName, shift.note].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                      {time(shift.startsAt)} – {time(shift.endsAt)}
                    </Text>
                    {/* Only a manager ever sees an unpublished shift, and they
                        should know the team cannot see it yet. */}
                    {!shift.published && <Text style={styles.muted}>not published</Text>}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      ))}
    </ScrollView>
  );
}
