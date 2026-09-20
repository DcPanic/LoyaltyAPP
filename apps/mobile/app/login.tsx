import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { API_URL, ApiError, checkApiReachable } from '../src/lib/api';
import { useSession } from '../src/lib/session';
import { Banner, Button, Card, styles } from '../src/components/ui';
import { theme } from '../src/theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);

  // Says plainly when the phone cannot see the API, which on a development
  // machine is nearly always a firewall or a different Wi-Fi network.
  useEffect(() => {
    let cancelled = false;
    void checkApiReachable().then((ok) => {
      if (!cancelled) setReachable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/stamp');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Could not reach the server at ${API_URL}. Check that the API is running and that this phone is on the same network.`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: 'center' }]}>
        <View style={{ alignItems: 'center', marginBottom: theme.spacing(2) }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: theme.colors.coffee,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 32 }}>☕</Text>
          </View>
          <Text style={[styles.h1, { marginTop: 12 }]}>LoyaltyApp</Text>
          <Text style={styles.muted}>Sign in with your café account</Text>
        </View>

        <Card>
          {error && <Banner tone="error">{error}</Banner>}
          {reachable === false && !error && (
            <Banner tone="error">Cannot reach the API at {API_URL}</Banner>
          )}
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@cafe.com"
              placeholderTextColor={theme.colors.muted}
            />
          </View>
          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              placeholderTextColor={theme.colors.muted}
            />
          </View>
          <Button label="Sign in" onPress={() => void submit()} loading={pending} />
        </Card>

        <Text style={[styles.muted, { textAlign: 'center' }]}>
          Staff accounts are created by the café owner from the dashboard.
        </Text>
        <Text style={[styles.muted, { textAlign: 'center', fontSize: 11 }]}>
          {reachable === true ? '● connected to ' : 'server: '}
          {API_URL}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
