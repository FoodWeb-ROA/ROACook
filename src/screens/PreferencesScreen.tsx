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
import { useTranslation } from 'react-i18next';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { useUnitSystem } from '../context/UnitSystemContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { DrawerActions } from '@react-navigation/native';

// Define navigation prop type for the Drawer
type PreferencesScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Preferences'>;

const PreferencesScreen = () => {
  const navigation = useNavigation<PreferencesScreenNavigationProp>();
  const { t, i18n } = useTranslation();
  const { showActionSheetWithOptions } = useActionSheet();
  const { unitSystem, toggleUnitSystem, isMetric } = useUnitSystem();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  const availableLanguages = [
    { code: 'en', name: t('english') },
    { code: 'es', name: t('spanish') },
    { code: 'fr', name: t('french') },
    { code: 'it', name: t('italian') },
  ];
  const currentLanguageCode = i18n.language;
  const currentLanguageName = availableLanguages.find(l => l.code === currentLanguageCode)?.name || currentLanguageCode;

  const showLanguageSelector = () => {
    const options = [...availableLanguages.map(l => l.name), t('cancel')];
    const cancelButtonIndex = options.length - 1;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: t('selectLanguage'),
      },
      (selectedIndex?: number) => {
        if (selectedIndex !== undefined && selectedIndex !== cancelButtonIndex) {
          const selectedLanguage = availableLanguages[selectedIndex];
          i18n.changeLanguage(selectedLanguage.code);
        }
      }
    );
  };

  const showUnitSystemSelector = () => {
    const options = [t('common.metric'), t('common.imperial'), t('cancel')];
    const cancelButtonIndex = options.length - 1;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: t('unitSystem'),
      },
      (selectedIndex?: number) => {
        if (selectedIndex !== undefined && selectedIndex !== cancelButtonIndex) {
          if ((selectedIndex === 0 && !isMetric) || (selectedIndex === 1 && isMetric)) {
            toggleUnitSystem();
          }
        }
      }
    );
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
          <Text style={styles.settingItemText}>{t(title)}</Text>
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

  const renderActionItem = (
    icon: string,
    title: string,
    currentValue: string,
    onPress: () => void,
  ) => {
    return (
      <TouchableOpacity style={styles.settingItem} onPress={onPress}>
        <View style={styles.settingItemLeft}>
          <MaterialCommunityIcons name={icon as any} size={24} color={COLORS.primary} />
          <Text style={styles.settingItemText}>{t(title)}</Text>
        </View>
        <View style={styles.settingItemRight}>
           <Text style={styles.settingValueText}>{currentValue}</Text>
           <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader
        title={t('preferencesTitle')}
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          {renderActionItem('account-circle-outline', 'navigation.account', '', 
            () => navigation.getParent<StackNavigationProp<RootStackParamList>>().navigate('Account'))}
          {renderSettingItem('bell-outline', 'notifications', notifications, setNotifications)}
          {renderActionItem('ruler', 'unitSystem', t(`common.${unitSystem}`), showUnitSystemSelector)}
          {renderActionItem('translate', 'language', currentLanguageName, showLanguageSelector)}
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
    minHeight: 60,
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
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    ...FONTS.body2, 
    color: COLORS.textLight,
    marginRight: SIZES.padding * 0.5,
  },
});

export default PreferencesScreen; 