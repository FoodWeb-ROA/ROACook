import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerParamList } from '../navigation/AppNavigator';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

// Define navigation prop types
type SupportScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Support'>;
type StackNavigationPropType = StackNavigationProp<RootStackParamList>;

const SupportScreen = () => {
  const navigation = useNavigation<SupportScreenNavigationProp>();
  const stackNavigation = useNavigation<StackNavigationPropType>();
  const { t } = useTranslation();

  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  const navigateToHelpScreen = () => {
    stackNavigation.navigate('HelpScreen');
  };

  const navigateToAboutScreen = () => {
    stackNavigation.navigate('About');
  };

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
        {onPress && (
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textLight} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaViewRN style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader
        title={t('screens.support.title')}
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          {renderSettingItem('help-circle-outline', t('screens.support.helpAndSupport'), navigateToHelpScreen)}
          {renderSettingItem('information-outline', t('screens.support.about'), navigateToAboutScreen)}
        </View>
      </ScrollView>
    </SafeAreaViewRN>
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

export default SupportScreen; 