import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackNavigationProp } from '@react-navigation/stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { DrawerParamList } from '../navigation/AppNavigator';
import AppHeader from '../components/AppHeader';
import { useTranslation } from 'react-i18next';
import { useTypedDispatch } from '../hooks/useTypedDispatch';
import { logoutWatch } from '../slices/authSlice';

// Define composite navigation prop type
type AccountScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, 'Account'>,
  StackNavigationProp<RootStackParamList>
>;

const AccountScreen = () => {
  const navigation = useNavigation<AccountScreenNavigationProp>();
  const { t } = useTranslation();
  const typedDispatch = useTypedDispatch();

  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: () => {
            typedDispatch(
              logoutWatch()
            );
          },
          style: 'destructive',
        },
      ],
    );
  };

  // Re-use or adapt renderSettingItem from SettingsScreen
  const renderSettingItem = (
    icon: string,
    title: string,
    onPress?: () => void,
  ) => {
    return (
      <TouchableOpacity 
        style={styles.settingItem}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.settingItemLeft}>
          <MaterialCommunityIcons name={icon as any} size={24} color={COLORS.primary} />
          <Text style={styles.settingItemText}>{title}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader
        title={t('screens.account.title')}
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          {renderSettingItem('account-outline', 'Edit Profile', () => console.log('Edit Profile'))}
          {renderSettingItem('key-outline', 'Change Password', () => console.log('Change Password'))}
          {renderSettingItem('restaurant-outline', 'Manage Kitchens', () => console.log('Manage Kitchens'))}
        </View>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('screens.account.logout')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  section: {
    marginTop: SIZES.padding * 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding * 1.5,
    paddingHorizontal: SIZES.padding * 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    ...FONTS.body1,
    color: COLORS.text,
    marginLeft: SIZES.padding * 1.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SIZES.padding * 2,
    marginTop: SIZES.padding * 3,
    marginBottom: SIZES.padding,
    padding: SIZES.padding * 1.2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    ...FONTS.h4,
    color: COLORS.error,
    marginLeft: SIZES.padding,
  },
});

export default AccountScreen; 