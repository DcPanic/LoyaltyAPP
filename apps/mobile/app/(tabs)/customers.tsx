import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../src/lib/api';
import { Card, styles } from '../../src/components/ui';
import { theme } from '../../src/theme';

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  stamps: number;
  stampsRequired: number;
  totalStamps: number;
  segment: string;
  lastActivityAt: string | null;
}

const SEGMENT_COLOR: Record<string, string> = {
  NEW: '#2a78d6',
  ACTIVE: '#1baf7a',
  VIP: '#eda100',
  AT_RISK: '#eb6834',
  LOST: '#e87ba4',
};

export default function CustomersScreen() {
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q?: string) => {
    const params = new URLSearchParams({ limit: '50' });
    if (q) params.set('q', q);
    const data = await api<{ items: CustomerRow[] }>(`/v1/customers?${params.toString()}`);
    setItems(data.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <View style={{ padding: 16, gap: 8 }}>
        <TextInput
          style={styles.input}
          placeholder="Search name, phone or email"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void load(query)}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(query).finally(() => setRefreshing(false));
            }}
          />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.muted}>No customers yet.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/customer/${item.id}`)}>
            <Card>
              <View style={styles.spread}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                    {item.firstName} {item.lastName ?? ''}
                  </Text>
                  <Text style={styles.muted}>{item.phone ?? item.email ?? '—'}</Text>
                  <Text style={[styles.muted, { color: SEGMENT_COLOR[item.segment] }]}>
                    {item.segment.replace('_', ' ').toLowerCase()}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.stamps}/{item.stampsRequired}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
