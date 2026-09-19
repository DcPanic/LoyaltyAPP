export const theme = {
  colors: {
    espresso: '#3B2416',
    coffee: '#6F4E37',
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
    dangerBg: '#FBEAE9',
  },
  radius: { sm: 10, md: 14, lg: 20 },
  spacing: (n: number) => n * 8,
} as const;
