// src/theme/index.ts
export const colours = {
  // ── Blues (primary brand) ──────────────────────────────
  primary:        '#1A3ADB',   // main blue — buttons, headers
  primaryDark:    '#1228A0',   // deep blue — gradient end
  primaryMid:     '#2D52E8',   // mid blue
  primaryLight:   '#5B8DEF',   // light blue — gradient start
  primaryFade:    'rgba(26,58,219,0.08)',

  // ── Accent ────────────────────────────────────────────
  accent:         '#00C2FF',   // cyan — highlights, badges
  accentLight:    'rgba(0,194,255,0.15)',

  // ── Backgrounds ───────────────────────────────────────
  background:     '#EEF2FF',   // light blue-white page bg
  surface:        '#FFFFFF',   // cards
  surfaceBlue:    '#F0F4FF',   // tinted card surface

  // ── Gradients (used with LinearGradient or fallback) ──
  gradientStart:  '#5B8DEF',
  gradientEnd:    '#1228A0',

  // ── Text ──────────────────────────────────────────────
  textPrimary:    '#0F1F5C',   // dark navy text
  textSecondary:  '#6B7280',
  textOnBlue:     '#FFFFFF',
  textMuted:      'rgba(255,255,255,0.65)',

  // ── Semantic ───────────────────────────────────────────
  success:        '#22C55E',
  error:          '#EF4444',
  warning:        '#F5A623',
  border:         '#E2E8F0',
  borderBlue:     'rgba(26,58,219,0.2)',

  // ── Utility ───────────────────────────────────────────
  white:          '#FFFFFF',
  black:          '#000000',
  transparent:    'transparent',
  overlay:        'rgba(0,0,0,0.52)',
} as const;

export const fontSizes = {
  xs:   11,
  sm:   13,
  md:   15,
  base: 16,
  lg:   18,
  xl:   22,
  xxl:  28,
  hero: 36,
} as const;

export const fontWeights = {
  regular:   '400',
  medium:    '500',
  semiBold:  '600',
  bold:      '700',
  extraBold: '800',
} as const;

export const letterSpacing = {
  tight:  -0.5,
  normal: 0,
  wide:   1.2,
  wider:  2.5,
} as const;

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  round: 999,
} as const;

export const shadows = {
  card: {
    shadowColor:    '#1A3ADB',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.10,
    shadowRadius:   8,
    elevation:      4,
  },
  strong: {
    shadowColor:    '#1A3ADB',
    shadowOffset:   { width: 0, height: 6 },
    shadowOpacity:  0.18,
    shadowRadius:   14,
    elevation:      10,
  },
  subtle: {
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.06,
    shadowRadius:   4,
    elevation:      2,
  },
  blue: {
    shadowColor:    '#1A3ADB',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.3,
    shadowRadius:   10,
    elevation:      8,
  },
} as const;

export const tabBar = {
  background:    '#000000',
  activeColor:   '#1A3ADB',
  inactiveColor: '#9CA3AF',
  height:        64,
  paddingBottom: 10,
} as const;

// ── Gradient helper (for views that simulate gradients) ─────
export const gradients = {
  bluePrimary: {
    colors: ['#5B8DEF', '#1228A0'] as string[],
    start:  { x: 0, y: 0 },
    end:    { x: 1, y: 1 },
  },
  blueCard: {
    colors: ['#2D52E8', '#1A3ADB'] as string[],
    start:  { x: 0, y: 0 },
    end:    { x: 1, y: 1 },
  },
  dark: {
    colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)'] as string[],
    start:  { x: 0, y: 0 },
    end:    { x: 0, y: 1 },
  },
} as const;

const theme = {
  colours,
  fontSizes,
  fontWeights,
  letterSpacing,
  spacing,
  radius,
  shadows,
  tabBar,
  gradients,
};

export default theme;