import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../navigation/AppNavigator';
import AppHeader from '../components/AppHeader';

// Define navigation prop type
type PreferencesScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Preferences'>;

const PreferencesScreen = () => {
  const navigation = useNavigation<PreferencesScreenNavigationProp>();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [metricUnits, setMetricUnits] = useState(true);

  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    value: boolean,
    onToggle: (value: boolean) => void,
  ) => {
    return (
      <View style={styles.settingItem}> 
        <View style={styles.settingItemLeft}>
          <MaterialCommunityIcons name={icon as any} size={24} color={COLORS.primary} />
          <Text style={styles.settingItemText}>{title}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.disabled, true: COLORS.primary }}
          thumbColor={value ? COLORS.white : COLORS.textLight}
          ios_backgroundColor={COLORS.disabled}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader
        title="Preferences"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          {renderSettingItem('theme-light-dark', 'Dark Mode', darkMode, setDarkMode)}
          {renderSettingItem('bell-outline', 'Notifications', notifications, setNotifications)}
          {renderSettingItem('sync', 'Auto-sync recipes', autoSync, setAutoSync)}
          {renderSettingItem('ruler', 'Use metric units', metricUnits, setMetricUnits)}
        </View>
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
});

export default PreferencesScreen; 