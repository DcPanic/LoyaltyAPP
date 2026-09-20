import { Tabs, Redirect } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSession } from '../../src/lib/session';
import { theme } from '../../src/theme';

function icon(symbol: string) {
  return ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{symbol}</Text>;
}

export default function TabsLayout() {
  const { user, loading, can } = useSession();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.coffee,
        tabBarInactiveTintColor: theme.colors.muted,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.ink,
      }}
    >
      <Tabs.Screen
        name="stamp"
        options={{ title: 'Stamp', tabBarIcon: icon('☕') }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: icon('👥'),
          href: can('customer:read') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: icon('▤'),
          href: can('analytics:read') ? undefined : null,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: 'Account', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
