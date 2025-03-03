import { DefaultTheme, configureFonts } from 'react-native-paper';

// App color palette
export const COLORS = {
  primary: '#5B6B5C',      // Sections on top of the screen (now lighter green)
  secondary: '#243B24',    // Subsections (now medium green)
  tertiary: '#4A8F4A',     // Accent color
  background: '#091A05',   // Main background
  surface: '#243B24',      // Surface elements
  error: '#FF5252',
  text: '#FFFFFF',         // Text color
  textLight: '#E0E0E0',    // Light text
  border: '#5B6B5C',       // Border color
  disabled: '#3E513E',
  placeholder: '#B0B0B0',
  backdrop: 'rgba(0, 0, 0, 0.7)',
  notification: '#4A8F4A',
  white: '#FFFFFF',
  black: '#000000',
};

// Font configuration
const fontConfig = {
  regular: {
    fontFamily: 'Poppins',
    fontWeight: 'normal' as const,
  },
  medium: {
    fontFamily: 'Poppins',
    fontWeight: '500' as const,
  },
  light: {
    fontFamily: 'Poppins',
    fontWeight: '300' as const,
  },
  thin: {
    fontFamily: 'Poppins',
    fontWeight: '100' as const,
  },
};

// App theme extending React Native Paper theme
export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
    error: COLORS.error,
    text: COLORS.text,
    disabled: COLORS.disabled,
    placeholder: COLORS.placeholder,
    backdrop: COLORS.backdrop,
    notification: COLORS.notification,
  },
  fonts: configureFonts({config: fontConfig}),
  roundness: 10,
};

// Spacing constants
export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  padding: 16,
  margin: 16,
  radius: 8,
  borderWidth: 1,
};

// Custom font styles
export const FONTS = {
  largeTitle: { fontSize: SIZES.xxxl, fontFamily: 'Poppins' },
  h1: { fontSize: SIZES.xxl, fontFamily: 'Poppins' },
  h2: { fontSize: SIZES.xl, fontFamily: 'Poppins' },
  h3: { fontSize: SIZES.large, fontFamily: 'Poppins' },
  h4: { fontSize: SIZES.medium, fontFamily: 'Poppins' },
  body1: { fontSize: SIZES.medium, fontFamily: 'Poppins' },
  body2: { fontSize: SIZES.font, fontFamily: 'Poppins' },
  body3: { fontSize: SIZES.small, fontFamily: 'Poppins' },
};

// Shadow styles
export const SHADOWS = {
  small: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
};