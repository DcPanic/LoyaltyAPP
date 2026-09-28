import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  addDays,
  hoursBetween,
  weekDayKeys,
  zonedDayKey,
  zonedStartOfDay,
  zonedTime,
} from '../../src/lib/time';
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
  /** The café's own timezone — never the phone's. */
  timezone: string;
  items: Shift[];
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const dayLabel = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * When the team works.
 *
 * Read-only: the rota is written on the dashboard and this is where it is
 * consulted, usually standing up and in a hurry. Today is called today rather
 * than given a date, because that is the question being asked.
 *
 * Every time here is the café's, not the phone's. A barista whose phone came
 * back from holiday still set to another country has to read the same eight
 * o'clock as the one on the wall, or they turn up at the wrong hour.
 */
export default function ShiftsScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Until the first reply arrives we do not know the café's zone, so the phone's
  // is used to pick a range. The range is asked for a day wide on each side and
  // the days are cut by the café's zone once it is known, so the week shown is
  // right either way.
  const tz = data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const days = weekDayKeys(addDays(zonedDayKey(new Date(), tz), weekOffset * 7));
  const today = zonedDayKey(new Date(), tz);

  const load = useCallback(async () => {
    try {
      setError(null);
      const zone = data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const week = weekDayKeys(addDays(zonedDayKey(new Date(), zone), weekOffset * 7));
      const from = zonedStartOfDay(addDays(week[0]!, -1), zone);
      const to = zonedStartOfDay(addDays(week[6]!, 2), zone);
      setData(
        await api<Schedule>(
          `/v1/schedule?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the schedule');
    }
    // data.timezone only ever refines the range; weekOffset is what moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const byDay = days.map((dayKey, i) => ({
    dayKey,
    name: DAY_NAMES[i]!,
    isToday: dayKey === today,
    shifts: (data?.items ?? []).filter((s) => zonedDayKey(s.startsAt, tz) === dayKey),
  }));

  const myHours =
    Math.round(
      byDay
        .flatMap((d) => d.shifts)
        .filter((s) => s.staffMembershipId === data?.myMembershipId)
        .reduce((total, s) => total + hoursBetween(s.startsAt, s.endsAt), 0) * 10,
    ) / 10;

  const label =
    weekOffset === 0
      ? 'This week'
      : weekOffset === 1
        ? 'Next week'
        : weekOffset === -1
          ? 'Last week'
          : `${dayLabel(days[0]!)} — ${dayLabel(days[6]!)}`;

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

      {byDay.map((day) => (
        <Card
          key={day.dayKey}
          style={day.isToday ? { borderColor: theme.colors.joyMango } : undefined}
        >
          <View style={styles.spread}>
            <Text style={styles.h2}>{day.isToday ? 'Today' : day.name}</Text>
            <Text style={styles.muted}>{dayLabel(day.dayKey)}</Text>
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
                      {zonedTime(shift.startsAt, tz)} – {zonedTime(shift.endsAt, tz)}
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
