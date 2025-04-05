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

// Define composite navigation prop type
type AccountScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, 'Account'>,
  StackNavigationProp<RootStackParamList>
>;

const AccountScreen = () => {
  const navigation = useNavigation<AccountScreenNavigationProp>();

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
            // Implement actual logout logic (e.g., call auth context logout)
            console.log("Logout Pressed");
            // Navigate to Login screen after logout
            navigation.navigate('Login');
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {/* Update AppHeader props */}
      <AppHeader
        title="Account"
        showMenuButton={true} // Show menu button instead of back button
        onMenuPress={openDrawerMenu} // Handle menu press
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Account Section from SettingsScreen */}
        <View style={styles.section}>
          {/* Remove section title if header title is sufficient */}
          {/* <Text style={styles.sectionTitle}>Account</Text> */}
          {renderSettingItem('account-outline', 'Edit Profile', () => console.log('Edit Profile'))}
          {renderSettingItem('key-outline', 'Change Password', () => console.log('Change Password'))}
          {renderSettingItem('restaurant-outline', 'Manage Kitchens', () => console.log('Manage Kitchens'))}
        </View>

        {/* Logout Button from SettingsScreen */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

// Copy relevant styles from SettingsScreen.tsx and adapt
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: SIZES.padding * 2, // Add margin top if section title removed
    // marginBottom: SIZES.padding * 2, // Remove bottom margin if only one section
  },
  // sectionTitle removed for now
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding * 1.5, // Adjusted padding
    paddingHorizontal: SIZES.padding * 2,
    backgroundColor: COLORS.surface, // Use surface color for items
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    // Add top border for the first item if section title removed
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    ...FONTS.body1, // Use slightly larger font
    color: COLORS.text, // Use main text color
    marginLeft: SIZES.padding * 1.5, // Adjusted margin
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SIZES.padding * 2,
    marginTop: SIZES.padding * 3, // Increased top margin
    marginBottom: SIZES.padding,
    padding: SIZES.padding * 1.2, // Adjusted padding
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface, // Use surface color
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    ...FONTS.h4, // Make logout text bolder/larger
    color: COLORS.error,
    marginLeft: SIZES.padding,
  },
});

export default AccountScreen; 