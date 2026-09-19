import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../src/lib/session';
import { API_URL } from '../../src/lib/api';
import { Button, Card, styles } from '../../src/components/ui';

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner — full access',
  MANAGER: 'Manager',
  STAFF: 'Staff — stamping only',
};

export default function SettingsScreen() {
  const { user, business, signOut } = useSession();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.h2}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <View style={styles.spread}>
          <Text style={styles.muted}>Café</Text>
          <Text style={{ fontWeight: '600' }}>{business?.name}</Text>
        </View>
        <View style={styles.spread}>
          <Text style={styles.muted}>Role</Text>
          <Text style={{ fontWeight: '600' }}>{ROLE_LABEL[user?.role ?? 'STAFF']}</Text>
        </View>
        <View style={styles.spread}>
          <Text style={styles.muted}>Locations</Text>
          <Text style={{ fontWeight: '600' }}>
            {user?.locationIds.length ? `${user.locationIds.length} assigned` : 'All'}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.h2}>What you can do</Text>
        {(user?.permissions ?? []).map((permission) => (
          <Text key={permission} style={styles.muted}>
            • {permission.replace(':', ' ')}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.muted}>Connected to {API_URL}</Text>
        <Text style={styles.muted}>
          Owner tools such as billing, campaigns and settings live in the web dashboard.
        </Text>
      </Card>

      <Button
        label="Sign out"
        variant="danger"
        onPress={() => {
          void signOut().then(() => router.replace('/login'));
        }}
      />
    </ScrollView>
  );
}
