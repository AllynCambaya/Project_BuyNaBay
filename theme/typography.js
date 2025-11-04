// theme/typography.js
import { Platform } from 'react-native';

/**
 * An object containing all the custom fonts to be loaded by the app.
 * This is used by `expo-font` in your App.js.
 */
export const customFontsToLoad = {
  'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
  'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
  'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
  'Poppins-ExtraBold': require('../assets/fonts/Poppins-ExtraBold.ttf'),
  'Poppins-Black': require('../assets/fonts/Poppins-Black.ttf'), // Heaviest weight for titles
};

/**
 * Defines the font families for use in stylesheets.
 * This makes it easy to switch fonts or apply them consistently.
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
 * Defines standard font sizes based on the design system.
 * Using these tokens ensures consistent text scaling.
 */
export const fontSizes = {
  xs: 12,
  sm: 14, // Standard label size
  md: 16, // Standard body/input text
  lg: 18, // Button text size
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 42, // Title size
};

/**
 * Maps font weights to their respective font families for platform consistency.
 * This is especially useful for Android, which relies on `fontWeight` hints.
 */
export const fontWeights = {
  regular: Platform.select({ ios: { fontWeight: '400' }, android: { fontFamily: fontFamily.regular } }),
  medium: Platform.select({ ios: { fontWeight: '500' }, android: { fontFamily: fontFamily.medium } }),
  semiBold: Platform.select({ ios: { fontWeight: '600' }, android: { fontFamily: fontFamily.semiBold } }),
  bold: Platform.select({ ios: { fontWeight: '700' }, android: { fontFamily: fontFamily.bold } }),
  extraBold: Platform.select({ ios: { fontWeight: '800' }, android: { fontFamily: fontFamily.extraBold } }),
  black: Platform.select({ ios: { fontWeight: '900' }, android: { fontFamily: fontFamily.black } }),
};

// Note: The setDefaultFont() monkey-patching function has been removed.
// It's a better practice to explicitly apply font styles using these tokens
// in your stylesheets for more predictable and maintainable code.