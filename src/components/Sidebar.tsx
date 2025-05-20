import React from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, TouchableWithoutFeedback, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { useTranslation } from 'react-i18next';
import { appLogger } from '../services/AppLogService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Sidebar component rendering drawer items in a floating rounded card
const Sidebar: React.FC<DrawerContentComponentProps> = (props) => {
  const { navigation } = props;
  const { t } = useTranslation();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Backdrop to catch taps */}
      <TouchableWithoutFeedback onPress={() => navigation.closeDrawer()}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Card with content */}
      <View style={styles.card}>
        {/* Close button */}
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={() => navigation.closeDrawer()}
        >
          <MaterialCommunityIcons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>

        {/* Logo header */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>{t('components.sidebar.logoText')}</Text>
        </View>

        {/* Non-scrollable menu content */}
        <View style={styles.menuContainer}>
          <DrawerItemList {...props} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.75,
    left: SCREEN_WIDTH / 2 - (SCREEN_WIDTH * 0.75) / 2,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius * 4,
    paddingVertical: 3*SIZES.base,
    paddingHorizontal: 0.5*SIZES.base,
    ...SHADOWS.large,
    maxHeight: '65%',
    opacity: 0.95,
  },
  closeButton: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  logoText: {
    color: COLORS.white,
    fontSize: SIZES.xl,
    fontWeight: 'bold',
  },
  menuContainer: {
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
  },
});

export default Sidebar; 