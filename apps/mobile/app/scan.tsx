import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Button, Card, styles } from '../src/components/ui';
import { theme } from '../src/theme';

/** Native QR scanning for the staff app; one result per open. */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const handled = useRef(false);

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Card>
          <Text style={styles.h2}>Camera access needed</Text>
          <Text style={styles.muted}>
            Allow the camera so you can scan the QR code on a customer&apos;s wallet card. You can
            still find customers by phone or name without it.
          </Text>
          <Button label="Allow camera" onPress={() => void requestPermission()} />
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          handled.current = true;
          setScanned(true);
          router.replace({ pathname: '/(tabs)/stamp', params: { code: data.trim() } });
        }}
      />
      <View style={{ padding: 16, backgroundColor: theme.colors.surface }}>
        <Text style={[styles.muted, { textAlign: 'center', marginBottom: 8 }]}>
          {scanned ? 'Found it — opening the card…' : 'Point the camera at the customer QR code'}
        </Text>
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}
