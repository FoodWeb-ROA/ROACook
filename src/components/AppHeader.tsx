import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showMenuButton?: boolean;
  onProfilePress?: () => void;
  onMenuPress?: () => void;
  rightComponent?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  showBackButton = false,
  showMenuButton = false,
  onProfilePress,
  onMenuPress,
  rightComponent,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>
        {showBackButton ? (
          <TouchableOpacity 
            style={styles.buttonStyle}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons 
              name="arrow-left" 
              size={32} 
              color={COLORS.white} 
            />
          </TouchableOpacity>
        ) : showMenuButton ? (
          <TouchableOpacity 
            style={styles.buttonStyle}
            onPress={onMenuPress || (() => {})}
          >
            <MaterialCommunityIcons 
              name="menu" 
              size={32} 
              color={COLORS.white} 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.buttonStyle}
            onPress={onProfilePress || (() => {})}
          >
            <MaterialCommunityIcons 
              name="account-circle" 
              size={36} 
              color={COLORS.white} 
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.centerContainer}>
        <Text style={styles.logoText}>FoodWeb</Text>
      </View>

      <View style={styles.rightContainer}>
        {rightComponent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    backgroundColor: COLORS.background,
  },
  leftContainer: {
    width: 50,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...FONTS.h2,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  buttonStyle: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppHeader;