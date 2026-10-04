import { Image, Linking, ScrollView, Share, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSession } from '../src/lib/session';
import { Button, Card, styles } from '../src/components/ui';
import { theme } from '../src/theme';

/**
 * The café's own code, for the counter.
 *
 * It is not generated here and it is not stored anywhere: the code is simply a
 * picture of the café's public join page, which has existed since the day the
 * café was created. That means it can never go stale, never needs regenerating,
 * and a printed one keeps working forever.
 */
export default function CounterQrScreen() {
  const { business } = useSession();
  const slug = business?.slug;

  if (!slug) {
    return (
      <View style={[styles.screen, { padding: theme.spacing(2) }]}>
        <Text style={styles.muted}>Sign in to see your code.</Text>
      </View>
    );
  }

  // All three come from the session: only the API knows where the web app
  // lives, and guessing it here is how a printed poster ends up pointing at a
  // tunnel address that expired last week.
  const qrImage = `${business.qrImageUrl}?size=900`;
  const posterUrl = business.posterUrl;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Counter code' }} />

      <Card>
        <Text style={styles.h2}>Your counter code</Text>
        <Text style={styles.muted}>
          Print it and put it where people pay. A customer points their camera at it and their
          loyalty card goes into their wallet — there is no app for them to install.
        </Text>

        <View style={{ alignItems: 'center', paddingVertical: theme.spacing(2) }}>
          <View
            style={{
              padding: 14,
              borderRadius: theme.radius.lg,
              backgroundColor: '#fff',
              ...{
                shadowColor: '#2A170B',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.18,
                shadowRadius: 20,
                elevation: 6,
              },
            }}
          >
            <Image
              source={{ uri: qrImage }}
              style={{ width: 240, height: 240 }}
              accessibilityLabel="Your café's QR code"
            />
          </View>
        </View>

        <Button
          label="Print the counter poster"
          onPress={() => void Linking.openURL(posterUrl)}
        />
        <Button
          label="Save the code"
          variant="secondary"
          onPress={() => void Linking.openURL(qrImage)}
        />
        <Button
          label="Send it to someone"
          variant="secondary"
          onPress={() =>
            void Share.share({
              message: `${business.name} — collect stamps, get rewards: ${business.joinUrl}`,
              url: business.joinUrl,
            })
          }
        />
      </Card>

      <Card>
        <Text style={styles.h2}>What each button does</Text>
        <Text style={styles.muted}>
          <Text style={{ fontWeight: '700' }}>Print the poster</Text> opens a ready-made sheet with
          your name, your offer and the code, sized for A4. Print it, or save it as a PDF and send
          it to a print shop.
        </Text>
        <Text style={styles.muted}>
          <Text style={{ fontWeight: '700' }}>Save the code</Text> opens the picture on its own,
          for putting on a sticker, a menu or a window.
        </Text>
        <Text style={styles.muted}>
          The code never changes, so anything you print stays good.
        </Text>
      </Card>
    </ScrollView>
  );
}
