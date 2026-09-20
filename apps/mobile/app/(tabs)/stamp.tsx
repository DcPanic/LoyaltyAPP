import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, ApiError, newIdempotencyKey } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';
import type { MembershipCard, RecentItem, SearchHit } from '../../src/lib/types';
import { Banner, Button, Card, StampRow, styles } from '../../src/components/ui';
import { theme } from '../../src/theme';

/**
 * The barista's main screen: find a customer (scan, search or phone order),
 * then add stamps. Everything is validated and recorded on the server.
 */
export default function StampScreen() {
  const { can } = useSession();
  const params = useLocalSearchParams<{ code?: string }>();

  const [card, setCard] = useState<MembershipCard | null>(null);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const data = await api<{ items: RecentItem[] }>('/v1/stamping/recent');
      setRecent(data.items);
    } catch {
      /* the strip is informational only */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecent();
    }, [loadRecent]),
  );

  const resolve = useCallback(async (code: string) => {
    setPending(true);
    setMessage(null);
    try {
      const data = await api<MembershipCard>('/v1/stamping/resolve', {
        method: 'POST',
        body: { code },
      });
      setCard(data);
      setHits(null);
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Could not read that code',
      });
    } finally {
      setPending(false);
    }
  }, []);

  // A scan from the camera modal comes back as a route parameter.
  useEffect(() => {
    if (params.code) {
      void resolve(String(params.code));
      router.setParams({ code: undefined });
    }
  }, [params.code, resolve]);

  async function search() {
    if (query.trim().length < 2) return;
    setPending(true);
    setMessage(null);
    try {
      const data = await api<{ items: SearchHit[] }>(
        `/v1/stamping/search?q=${encodeURIComponent(query.trim())}`,
      );
      setHits(data.items);
      if (data.items.length === 1) await openCard(data.items[0]!.membershipId);
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Search failed',
      });
    } finally {
      setPending(false);
    }
  }

  async function openCard(membershipId: string) {
    setPending(true);
    try {
      setCard(await api<MembershipCard>(`/v1/stamping/card/${membershipId}`));
      setHits(null);
    } finally {
      setPending(false);
    }
  }

  async function addStamps(amount: number, channel: string) {
    if (!card) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await api<{ stampsAdded: number; rewardUnlocked: boolean; duplicate: boolean }>(
        '/v1/stamping/stamp',
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
          body: { membershipId: card.membership.id, amount, channel },
        },
      );
      await openCard(card.membership.id);
      await loadRecent();
      setMessage({
        tone: 'success',
        text: result.rewardUnlocked
          ? `${card.program.rewardName} unlocked for ${card.customer.firstName}! 🎁`
          : `+${result.stampsAdded} for ${card.customer.firstName}`,
      });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Could not add the stamp',
      });
    } finally {
      setPending(false);
    }
  }

  async function redeem() {
    if (!card) return;
    setPending(true);
    try {
      await api('/v1/stamping/redeem', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { membershipId: card.membership.id },
      });
      await openCard(card.membership.id);
      await loadRecent();
      setMessage({ tone: 'success', text: `${card.program.rewardName} redeemed 🎁` });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Could not redeem the reward',
      });
    } finally {
      setPending(false);
    }
  }

  /**
   * Fixing a reward that was handed over by mistake. The counter tag redeems a
   * full card on its own, so whoever is standing there needs to be able to put
   * it back without calling the owner.
   */
  function undoRedeem() {
    if (!card) return;
    const name = card.customer.firstName;
    Alert.alert(
      'Put the reward back?',
      `${name}'s card fills up again and the reward can be used later. The correction is recorded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Put it back',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setPending(true);
              setMessage(null);
              try {
                await api('/v1/stamping/undo-redeem', {
                  method: 'POST',
                  body: { membershipId: card.membership.id },
                });
                await openCard(card.membership.id);
                await loadRecent();
                setMessage({ tone: 'success', text: `Reward put back for ${name}` });
              } catch (err) {
                setMessage({
                  tone: 'error',
                  text: err instanceof ApiError ? err.message : 'Could not put the reward back',
                });
              } finally {
                setPending(false);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadRecent().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      {!card ? (
        <Card>
          <Text style={styles.h2}>Stamp a customer</Text>
          <Button label="Scan customer QR" onPress={() => router.push('/scan')} />

          <Text style={[styles.label, { marginTop: 8 }]}>Or find them</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone, email, name or member code"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void search()}
            returnKeyType="search"
          />
          <Text style={styles.muted}>
            Works for phone and delivery orders — the customer does not need to be here.
          </Text>
          <Button
            label="Search"
            variant="secondary"
            onPress={() => void search()}
            loading={pending}
          />

          {hits?.length === 0 && <Text style={styles.muted}>No customer matches “{query}”.</Text>}
          {hits && hits.length > 0 && (
            <View style={{ gap: 8, marginTop: 8 }}>
              {hits.map((hit) => (
                <Pressable
                  key={hit.membershipId}
                  onPress={() => void openCard(hit.membershipId)}
                  style={[styles.card, styles.spread, { padding: 12 }]}
                >
                  <View>
                    <Text style={{ fontWeight: '700', color: theme.colors.ink }}>{hit.name}</Text>
                    <Text style={styles.muted}>{hit.phone ?? hit.email ?? hit.memberCode}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {hit.stamps}/{hit.stampsRequired}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <View style={styles.spread}>
            <View>
              <Text style={styles.h2}>
                {card.customer.firstName} {card.customer.lastName ?? ''}
              </Text>
              <Text style={styles.muted}>{card.customer.phone ?? card.customer.email}</Text>
            </View>
            <Pressable onPress={() => setCard(null)}>
              <Text style={{ color: theme.colors.coffee, fontWeight: '700' }}>Change</Text>
            </Pressable>
          </View>

          <StampRow stamps={card.membership.stamps} required={card.membership.stampsRequired} />
          <Text style={styles.muted}>
            {card.membership.stamps} / {card.membership.stampsRequired} stamps ·{' '}
            {card.membership.totalStamps} all-time
          </Text>

          {card.membership.rewardAvailable && (
            <View style={{ gap: 8 }}>
              <Banner tone="success">
                {card.pendingReward?.name ?? card.program.rewardName} is ready
              </Banner>
              {can('reward:redeem') && (
                <Button label="Redeem reward" onPress={() => void redeem()} loading={pending} />
              )}
            </View>
          )}

          <Text style={styles.label}>Add stamps</Text>
          <View style={styles.row}>
            {card.program.allowedStampAmounts.map((amount) => (
              <Pressable
                key={amount}
                onPress={() => void addStamps(amount, 'STAFF_APP')}
                disabled={pending}
                style={({ pressed }) => [
                  styles.card,
                  {
                    minWidth: 68,
                    alignItems: 'center',
                    paddingVertical: 16,
                    opacity: pressed || pending ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.ink }}>
                  +{amount}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                label="+1 phone order"
                variant="secondary"
                onPress={() => void addStamps(1, 'PHONE_ORDER')}
                disabled={pending}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="+1 delivery"
                variant="secondary"
                onPress={() => void addStamps(1, 'DELIVERY')}
                disabled={pending}
              />
            </View>
          </View>

          {can('reward:redeem') && card.membership.rewardsRedeemed > 0 && (
            <Pressable onPress={undoRedeem} disabled={pending} style={{ paddingVertical: 8 }}>
              <Text style={[styles.muted, { textAlign: 'center', textDecorationLine: 'underline' }]}>
                Given by mistake? Put the last reward back
              </Text>
            </Pressable>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.h2}>Recent activity</Text>
        {recent.length === 0 ? (
          <Text style={styles.muted}>Nothing yet today.</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={recent}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: theme.colors.line, marginVertical: 8 }} />
            )}
            renderItem={({ item }) => (
              <View style={styles.spread}>
                <View>
                  <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>
                    {item.customerName}
                  </Text>
                  <Text style={styles.muted}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {item.channel.toLowerCase().replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.type === 'REWARD_REDEEMED' ? '🎁 reward' : `+${item.amount}`}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </Card>
    </ScrollView>
  );
}
