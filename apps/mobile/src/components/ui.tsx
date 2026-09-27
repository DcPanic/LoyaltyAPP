import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LIFT, shadow, theme } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * A button with a base under it.
 *
 * React Native has no gradients or inset shadows, so depth is literal: a dark
 * base View, and a lighter face sitting `LIFT` points above it. Pressing moves
 * the face down onto the base, which is the same thing a real key does and
 * reads instantly on a counter, at arm's length, in a hurry.
 */
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
  const base =
    variant === 'danger'
      ? theme.colors.dangerDark
      : variant === 'secondary'
        ? theme.colors.line
        : theme.colors.coffeeDark;

  return (
    <View style={[styles.buttonBase, { backgroundColor: base }, (disabled || loading) && styles.dim]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled || loading) }}
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.buttonFace,
          variant === 'secondary' && styles.buttonFaceSecondary,
          variant === 'danger' && styles.buttonFaceDanger,
          pressed && styles.buttonFacePressed,
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
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <View style={[styles.banner, tone === 'error' ? styles.bannerError : styles.bannerSuccess]}>
      <View style={[styles.bannerBar, tone === 'error' ? styles.bannerBarError : styles.bannerBarOk]} />
      <Text style={tone === 'error' ? styles.bannerErrorText : styles.bannerSuccessText}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The card, as tokens.
 *
 * A collected stamp sits on top of the card and an empty one is a hole in it,
 * so a barista can read someone's progress across the counter without counting.
 * The next one to be earned wears an amber ring: it is the only slot that
 * changes anything if the customer buys something now.
 */
export function StampRow({ stamps, required }: { stamps: number; required: number }) {
  const filled = Math.min(stamps, required);
  return (
    <View
      style={styles.stampRow}
      accessibilityRole="image"
      accessibilityLabel={`${stamps} of ${required} stamps`}
    >
      {Array.from({ length: required }, (_, i) => {
        const isFilled = i < filled;
        const isNext = !isFilled && i === filled;
        return (
          <View key={i} style={styles.stampSlot}>
            {isFilled && <View style={styles.stampShadow} />}
            <View
              style={[
                styles.stamp,
                isFilled && styles.stampFilled,
                isNext && styles.stampNext,
              ]}
            >
              {isFilled && <View style={styles.stampGloss} />}
              <Text style={isFilled ? styles.stampTextFilled : styles.stampText}>
                {isFilled ? '☕' : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const STAMP = 38;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing(2), gap: theme.spacing(1.5) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: theme.spacing(2),
    gap: theme.spacing(1),
    ...shadow.card,
  },
  h1: { fontSize: 24, fontWeight: '700', color: theme.colors.ink },
  h2: { fontSize: 19, fontWeight: '800', color: theme.colors.ink, letterSpacing: -0.3 },
  muted: { color: theme.colors.muted, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.ink, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: theme.colors.cream,
    color: theme.colors.ink,
  },

  buttonBase: { borderRadius: theme.radius.sm, ...shadow.raised },
  buttonFace: {
    backgroundColor: theme.colors.coffee,
    borderRadius: theme.radius.sm,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: LIFT,
  },
  buttonFaceSecondary: { backgroundColor: theme.colors.surface },
  buttonFaceDanger: { backgroundColor: theme.colors.danger },
  buttonFacePressed: { bottom: 0 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  buttonTextSecondary: { color: theme.colors.ink },
  dim: { opacity: 0.55 },

  banner: {
    borderRadius: theme.radius.sm,
    padding: 12,
    paddingLeft: 16,
    overflow: 'hidden',
  },
  bannerBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  bannerBarOk: { backgroundColor: theme.colors.success },
  bannerBarError: { backgroundColor: theme.colors.danger },
  bannerSuccess: { backgroundColor: theme.colors.successBg },
  bannerError: { backgroundColor: theme.colors.dangerBg },
  bannerSuccessText: { color: theme.colors.success, fontWeight: '700' },
  bannerErrorText: { color: theme.colors.danger, fontWeight: '700' },

  stampRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stampSlot: { width: STAMP, height: STAMP },
  /* A darker disc peeking out below the token is what makes it look like an
     object resting on the card rather than a circle printed on it. */
  stampShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 3,
    height: STAMP,
    borderRadius: STAMP / 2,
    backgroundColor: theme.colors.coffeeDark,
  },
  stamp: {
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    backgroundColor: theme.colors.cream,
    borderWidth: 2,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stampFilled: {
    backgroundColor: theme.colors.coffee,
    borderColor: theme.colors.coffeeDark,
    ...shadow.token,
  },
  stampNext: {
    backgroundColor: theme.colors.joyMangoSoft,
    borderColor: theme.colors.joyMango,
  },
  /* A crescent of light across the top of the token. */
  stampGloss: {
    position: 'absolute',
    top: -STAMP * 0.42,
    left: -2,
    right: -2,
    height: STAMP * 0.72,
    borderRadius: STAMP,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  stampText: { fontSize: 14 },
  stampTextFilled: { fontSize: 15, color: '#fff' },

  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    backgroundColor: theme.colors.joyMangoSoft,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.joyMango,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: theme.colors.espresso },
  statValue: { fontSize: 30, fontWeight: '800', color: theme.colors.ink, letterSpacing: -0.5 },
});
