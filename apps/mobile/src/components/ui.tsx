import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.colors.ink : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Banner({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <View style={[styles.banner, tone === 'error' ? styles.bannerError : styles.bannerSuccess]}>
      <Text style={tone === 'error' ? styles.bannerErrorText : styles.bannerSuccessText}>
        {children}
      </Text>
    </View>
  );
}

export function StampRow({ stamps, required }: { stamps: number; required: number }) {
  const filled = Math.min(stamps, required);
  return (
    <View
      style={styles.stampRow}
      accessibilityRole="image"
      accessibilityLabel={`${stamps} of ${required} stamps`}
    >
      {Array.from({ length: required }, (_, i) => (
        <View key={i} style={[styles.stamp, i < filled && styles.stampFilled]}>
          <Text style={i < filled ? styles.stampTextFilled : styles.stampText}>
            {i < filled ? '☕' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },
  h1: { fontSize: 24, fontWeight: '700', color: theme.colors.ink },
  h2: { fontSize: 18, fontWeight: '700', color: theme.colors.ink },
  muted: { color: theme.colors.muted, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.ink, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
  },
  button: {
    backgroundColor: theme.colors.coffee,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  buttonDanger: { backgroundColor: theme.colors.danger },
  buttonDisabled: { opacity: 0.6 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonTextSecondary: { color: theme.colors.ink },
  banner: { borderRadius: theme.radius.sm, padding: 12 },
  bannerSuccess: { backgroundColor: theme.colors.successBg },
  bannerError: { backgroundColor: theme.colors.dangerBg },
  bannerSuccessText: { color: theme.colors.success, fontWeight: '600' },
  bannerErrorText: { color: theme.colors.danger, fontWeight: '600' },
  stampRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stamp: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampFilled: {
    backgroundColor: theme.colors.coffee,
    borderColor: theme.colors.coffee,
    borderStyle: 'solid',
  },
  stampText: { fontSize: 14 },
  stampTextFilled: { fontSize: 14, color: '#fff' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    backgroundColor: theme.colors.cream,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.espresso },
  statValue: { fontSize: 28, fontWeight: '700', color: theme.colors.ink },
});
