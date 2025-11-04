// theme/typography.js
import { Platform } from 'react-native';

/**
 * Custom fonts to be loaded by expo-font in App.js
 */
export const customFontsToLoad = {
  'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
  'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
  'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  'Poppins-ExtraBold': require('../assets/fonts/Poppins-ExtraBold.ttf'),
  'Poppins-Black': require('../assets/fonts/Poppins-Black.ttf'),
};

/**
 * Font families for consistent typography
 */
export const fontFamily = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semiBold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
  extraBold: 'Poppins-ExtraBold',
  black: 'Poppins-Black',
};

/**
 * Font sizes following a consistent scale
 */
export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 42,
};

/**
 * Font weights mapped to font families for cross-platform consistency
 */
export const fontWeights = {
  regular: Platform.select({
    ios: { fontWeight: '400' },
    android: { fontFamily: fontFamily.regular }
  }),
  medium: Platform.select({
    ios: { fontWeight: '500' },
    android: { fontFamily: fontFamily.medium }
  }),
  semiBold: Platform.select({
    ios: { fontWeight: '600' },
    android: { fontFamily: fontFamily.semiBold }
  }),
  bold: Platform.select({
    ios: { fontWeight: '700' },
    android: { fontFamily: fontFamily.bold }
  }),
  extraBold: Platform.select({
    ios: { fontWeight: '800' },
    android: { fontFamily: fontFamily.extraBold }
  }),
  black: Platform.select({
    ios: { fontWeight: '900' },
    android: { fontFamily: fontFamily.black }
  }),
};

/**
 * Line heights for better readability
 */
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
  loose: 2,
};

/**
 * Letter spacing for refined typography
 */
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
};

/**
 * Complete text style presets for common use cases
 */
export const textStyles = {
  // Headers
  h1: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSizes['4xl'],
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: fontSizes['3xl'],
    lineHeight: fontSizes['3xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamily.bold,
    fontSize: fontSizes['2xl'],
    lineHeight: fontSizes['2xl'] * lineHeights.normal,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSizes.xl,
    lineHeight: fontSizes.xl * lineHeights.normal,
  },
  
  // Body
  bodyLarge: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.lg,
    lineHeight: fontSizes.lg * lineHeights.relaxed,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.md,
    lineHeight: fontSizes.md * lineHeights.relaxed,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },
  
  // UI Elements
  button: {
    fontFamily: fontFamily.bold,
    fontSize: fontSizes.md,
    letterSpacing: letterSpacing.wide,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wider,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * lineHeights.normal,
  },
};