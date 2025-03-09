import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  
  // Preference states
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [metricUnits, setMetricUnits] = useState(true);
  
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
            // In a real app, clear authentication state
            navigation.navigate('Login');
          },
          style: 'destructive',
        },
      ],
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    value?: boolean,
    onToggle?: (value: boolean) => void,
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
        
        {onToggle && (
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
          />
        )}
        
        {onPress && (
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textLight} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader
        title="Settings"
        showBackButton={false}
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {renderSettingItem('theme-light-dark', 'Dark Mode', darkMode, setDarkMode)}
          {renderSettingItem('bell-outline', 'Notifications', notifications, setNotifications)}
          {renderSettingItem('sync', 'Auto-sync recipes', autoSync, setAutoSync)}
          {renderSettingItem('ruler', 'Use metric units', metricUnits, setMetricUnits)}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {renderSettingItem('account-outline', 'Edit Profile', undefined, undefined, () => console.log('Edit Profile'))}
          {renderSettingItem('key-outline', 'Change Password', undefined, undefined, () => console.log('Change Password'))}
          {renderSettingItem('restaurant-outline', 'Manage Kitchens', undefined, undefined, () => console.log('Manage Kitchens'))}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {renderSettingItem('help-circle-outline', 'Help & Support', undefined, undefined, () => console.log('Help & Support'))}
          {renderSettingItem('information-outline', 'About', undefined, undefined, () => console.log('About'))}
          {renderSettingItem('message-outline', 'Send Feedback', undefined, undefined, () => console.log('Send Feedback'))}
        </View>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: SIZES.padding * 2,
  },
  sectionTitle: {
    ...FONTS.h4,
    color: COLORS.textLight,
    marginHorizontal: SIZES.padding * 2,
    marginVertical: SIZES.padding,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 2,
    backgroundColor: COLORS.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemText: {
    ...FONTS.body2,
    color: COLORS.white,
    marginLeft: SIZES.padding,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SIZES.padding * 2,
    marginTop: SIZES.padding * 2,
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    ...FONTS.body2,
    color: COLORS.error,
    marginLeft: SIZES.padding,
  },
  versionContainer: {
    alignItems: 'center',
    marginVertical: SIZES.padding * 2,
  },
  versionText: {
    ...FONTS.body3,
    color: COLORS.textLight,
  },
});

export default SettingsScreen;