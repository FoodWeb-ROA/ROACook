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
import { DrawerParamList } from '../navigation/AppNavigator';
import AppHeader from '../components/AppHeader';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';

// Define navigation prop type
type SupportScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Support'>;

const SupportScreen = () => {
  const navigation = useNavigation<SupportScreenNavigationProp>();

  const openDrawerMenu = () => {
    navigation.openDrawer();
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
        title="Support"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          {renderSettingItem('help-circle-outline', 'Help & Support', () => console.log('Help & Support'))}
          {renderSettingItem('information-outline', 'About', () => console.log('About'))}
          {renderSettingItem('message-outline', 'Send Feedback', () => console.log('Send Feedback'))}
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