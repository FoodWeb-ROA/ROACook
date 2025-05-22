import { DefaultTheme, configureFonts } from 'react-native-paper';

// App color palette
export const COLORS = {
  primary: '#5B6B5C',      // Sections on top of the screen (now lighter green)
  secondary: 'rgba(35, 57, 29, 0.9)',    // Subsections (now medium green)
  tertiary: 'rgba(82, 151, 85, 0.48)',     // Accent color
  background: '#091A05',   // Main background
  surface: '#243B24',      // Surface elements
  cardBackground: '#182D12', // Card background color
  inputBackground: '#2E4526', // Input field background
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

  // Added colors for status
  warning: '#FFA726',      // Orange for warnings
  info: '#29B6F6',         // Blue for informational messages
  success: '#66BB6A',      // Green for success messages (can use 'notification' if preferred)
  lightGray: '#BDBDBD',    // A light gray for less prominent text or borders
};

// Font configuration
const fontConfig = {
  regular: {
    fontFamily: 'Poppins',
    fontWeight: 'normal' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  medium: {
    fontFamily: 'Poppins',
    fontWeight: '500' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  light: {
    fontFamily: 'Poppins',
    fontWeight: '300' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  thin: {
    fontFamily: 'Poppins',
    fontWeight: '100' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.5,
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
    cardBackground: COLORS.cardBackground,
    inputBackground: COLORS.inputBackground,

    // Ensure new colors are also part of the exported theme.colors
    warning: COLORS.warning,
    info: COLORS.info,
    success: COLORS.success, 
    lightGray: COLORS.lightGray,
  },
  fonts: configureFonts({config: fontConfig}), // Lint error here is noted but not addressed now
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
  largeTitle: { fontSize: SIZES.xxxl, fontFamily: 'Poppins', fontWeight: '800' },
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
  // Added dark shadow for tooltip
  dark: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30, // More pronounced opacity
    shadowRadius: 8,
    elevation: 10,       // Higher elevation for more distinct shadow
  },
};