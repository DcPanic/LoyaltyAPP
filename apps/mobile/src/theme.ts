/**
 * The staff app's palette.
 *
 * `joy` is the accent set the customer-facing pages use too. It never carries
 * meaning on its own — it lifts a surface, marks the next thing to collect,
 * celebrates a reward — so the brown that belongs to the café stays in charge.
 *
 * `depth` is here because React Native has no inset shadow and no gradient: a
 * raised thing is a light face sitting on a darker base, and pressing it moves
 * the face down onto the base. Keeping those two colours in one place is what
 * stops buttons and stamps from drifting apart.
 */
export const theme = {
  colors: {
    espresso: '#3B2416',
    coffee: '#6F4E37',
    coffeeDark: '#4A3122',
    caramel: '#B07D4F',
    cream: '#F6EFE6',
    surface: '#FFFFFF',
    bg: '#FAF6F1',
    ink: '#241A13',
    muted: '#7A6A5D',
    line: '#E8DED1',
    success: '#2F7D52',
    successBg: '#E6F3EC',
    danger: '#B3261E',
    dangerDark: '#7E1A15',
    dangerBg: '#FBEAE9',

    joyMango: '#FFB020',
    joyMangoSoft: '#FFF0D2',
    joyBerry: '#FF5D8F',
    joyMint: '#2ED3A0',
    joySky: '#4CC3FF',
    joyGrape: '#8B5CF6',
  },
  radius: { sm: 12, md: 18, lg: 24, pill: 999 },
  spacing: (n: number) => n * 8,
} as const;

/** How far a raised face sits above its base, in points. */
export const LIFT = 4;

/**
 * Shadows, written once. iOS reads the four shadow properties and Android
 * reads elevation, so both have to be given or the app looks flat on one of
 * them — which is the usual way this sort of thing goes wrong.
 */
export const shadow = {
  card: {
    shadowColor: '#2A170B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  raised: {
    shadowColor: '#2A170B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  token: {
    shadowColor: '#2A170B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;
