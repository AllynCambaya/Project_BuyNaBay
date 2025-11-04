// theme/theme.js
import { palette } from './colors';

export const lightTheme = {
  // Base
  background: palette.light_background,
  gradientBackground: palette.light_gradient,
  
  // Cards & Surfaces
  cardBackground: palette.light_card,
  cardBackgroundAlt: palette.light_cardAlt,
  
  // Text
  text: palette.light_text,
  textSecondary: palette.light_text_secondary,
  textTertiary: palette.light_text_tertiary,
  
  // Inputs
  inputBackground: palette.light_card,
  inputBackgroundFocused: '#FFFFFF',
  inputBackgroundError: '#FFF5F5',
  inputText: palette.light_text,
  inputIcon: '#7A7A9A',
  placeholder: '#9A9AB0',
  
  // Brand Colors
  primary: palette.primary,
  accent: palette.accent,
  accentSecondary: palette.accentSecondary,
  
  // Buttons
  buttonPrimary: palette.primary,
  buttonSecondary: palette.light_cardAlt,
  buttonDisabled: '#D0D0E0',
  
  // Feedback
  error: palette.error,
  errorDark: palette.errorDark,
  success: palette.success,
  successDark: palette.successDark,
  warning: palette.warning,
  info: palette.info,
  
  // Borders & Dividers
  borderColor: palette.light_border,
  borderTransparent: 'transparent',
  divider: palette.light_divider,
  dividerText: '#9A9AB0',
  
  // Special Backgrounds
  infoBackground: 'rgba(253, 173, 0, 0.08)',
  infoBorder: palette.primary,
  infoText: '#5A5A7A',
  iconCircleBackground: 'rgba(253, 173, 0, 0.1)',
  
  // Shadows
  shadowColor: palette.light_shadow,
  
  // Notifications
  notificationColor: palette.notification,
};

export const darkTheme = {
  // Base
  background: palette.dark_background,
  gradientBackground: palette.dark_gradient,
  
  // Cards & Surfaces
  cardBackground: palette.dark_card,
  cardBackgroundAlt: palette.dark_cardAlt,
  
  // Text
  text: palette.dark_text,
  textSecondary: palette.dark_text_secondary,
  textTertiary: palette.dark_text_tertiary,
  
  // Inputs
  inputBackground: palette.dark_input,
  inputBackgroundFocused: '#2D2D5A',
  inputBackgroundError: '#3A2828',
  inputText: palette.dark_text,
  inputIcon: '#8A8A9E',
  placeholder: '#6A6A7E',
  
  // Brand Colors
  primary: palette.primary,
  accent: palette.accent,
  accentSecondary: palette.accentSecondary,
  
  // Buttons
  buttonPrimary: palette.primary,
  buttonSecondary: palette.dark_cardAlt,
  buttonDisabled: '#4A4A6A',
  
  // Feedback
  error: palette.error,
  errorDark: palette.errorDark,
  success: palette.success,
  successDark: palette.successDark,
  warning: palette.warning,
  info: palette.info,
  
  // Borders & Dividers
  borderColor: palette.dark_border,
  borderTransparent: 'transparent',
  divider: palette.dark_divider,
  dividerText: '#6A6A7E',
  
  // Special Backgrounds
  infoBackground: 'rgba(253, 173, 0, 0.12)',
  infoBorder: palette.accent,
  infoText: '#B8B8CC',
  iconCircleBackground: 'rgba(253, 173, 0, 0.15)',
  
  // Shadows
  shadowColor: palette.dark_shadow,
  
  // Notifications
  notificationColor: palette.notification,
};