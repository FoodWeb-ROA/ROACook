import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onProfilePress?: () => void;
  rightComponent?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  showBackButton = false,
  onProfilePress,
  rightComponent,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>
        {showBackButton ? (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons 
              name="arrow-left" 
              size={32} 
              color={COLORS.white} 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.profileButton}
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

      <View style={styles.centerContainer} />

      <View style={styles.rightContainer}>
        {rightComponent || (
          <Text style={styles.logoText}>ROA</Text>
        )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
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
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppHeader;