import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Button as RNButton,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../data/supabaseClient';

// Define navigation prop type - updated to use only Stack navigator
type AccountScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Account'>;

const AccountScreen = () => {
  const navigation = useNavigation<AccountScreenNavigationProp>();
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth(); // Removed session as it's not directly used here
  
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState(''); // State for new email
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false); // Loading state for email update

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('screens.account.error.notAuthenticated'));
      return;
    }
    if (fullName.trim() === (user.user_metadata?.full_name || '')) {
      Alert.alert(t('common.info'), t('screens.account.info.noChanges'));
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });

      if (error) throw error;
      
      Alert.alert(t('common.success'), t('screens.account.success.profileUpdated'));
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert(t('common.error'), error.message || t('screens.account.error.updateFailed'));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('screens.account.error.notAuthenticated'));
      return;
    }
    if (!newEmail || newEmail.trim() === user.email) {
      Alert.alert(t('common.info'), t('screens.account.info.noEmailChange'));
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

      if (error) throw error;

      setNewEmail(''); // Clear input on success
      Alert.alert(
        t('common.success'),
        t('screens.account.success.emailUpdateInitiated', { email: newEmail.trim() })
      );
    } catch (error: any) {
      console.error('Error updating email:', error);
      Alert.alert(t('common.error'), error.message || t('screens.account.error.emailUpdateFailed'));
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('screens.account.error.notAuthenticated'));
      return;
    }
    if (!newPassword) {
      Alert.alert(t('common.error'), t('screens.account.error.newPasswordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('screens.account.error.passwordsDoNotMatch'));
      return;
    }
    // Note: Supabase auth.updateUser doesn't require current password for email provider
    // If using a different provider or custom logic, currentPassword check might be needed here.

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('common.success'), t('screens.account.success.passwordUpdated'));

    } catch (error: any) {
      console.error('Error updating password:', error);
      Alert.alert(t('common.error'), error.message || t('screens.account.error.passwordUpdateFailed'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('screens.account.logout.title'),
      t('screens.account.logout.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.logout'), onPress: signOut, style: 'destructive' },
      ],
    );
  };

  if (authLoading) {
     return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Check if the user signed in using email/password provider
  const isEmailProvider = user?.app_metadata?.provider === 'email';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader
        title={t('navigation.account')}
        showBackButton={true}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Profile Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('screens.account.profileInfo')}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('screens.account.email')}:</Text>
            <Text style={styles.value}>{user?.email || '-'}</Text>
          </View>
          
          <Text style={styles.labelInput}>{t('screens.account.fullName')}:</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('screens.account.fullNamePlaceholder')}
            autoCapitalize="words"
          />
          <RNButton
            title={isUpdatingProfile ? t('common.updating') : t('screens.account.updateProfile')}
            onPress={handleUpdateProfile} 
            disabled={isUpdatingProfile}
            color={COLORS.primary}
          />

          {/* MOVED Email Update Input and Button here */}
          <Text style={[styles.labelInput, styles.inputSpacing]}>{t('screens.account.newEmail')}:</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder={t('screens.account.newEmailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <RNButton
            title={isUpdatingEmail ? t('common.updating') : t('screens.account.updateEmail')}
            onPress={handleUpdateEmail}
            disabled={isUpdatingEmail}
            color={COLORS.primary}
          />
        </View>

        {/* Change Password Section - Only for Email Provider */}
        {isEmailProvider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('screens.account.security')}</Text>
            
            <Text style={styles.labelInput}>{t('screens.account.newPassword')}:</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('screens.account.newPasswordPlaceholder')}
              secureTextEntry
            />

            <Text style={styles.labelInput}>{t('screens.account.confirmPassword')}:</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('screens.account.confirmPasswordPlaceholder')}
              secureTextEntry
            />
            <RNButton
              title={isUpdatingPassword ? t('common.updating') : t('screens.account.updatePassword')}
              onPress={handleChangePassword}
              disabled={isUpdatingPassword}
              color={COLORS.primary}
            />
          </View>
        )}

        {/* Manage Kitchens Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('ManageKitchens')}
          >
            <Text style={styles.buttonText}>{t('navigation.manageKitchens')}</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <RNButton
            title={t('screens.account.logout.button')} 
            onPress={handleLogout} 
            color={COLORS.error}
          />
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
     padding: SIZES.padding * 2,
  },
  section: {
    marginBottom: SIZES.padding * 3,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    // Removed shadow to avoid potential dependency
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SIZES.padding * 2,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: SIZES.padding * 1.5,
    alignItems: 'center',
  },
  label: {
    ...FONTS.body1,
    color: COLORS.textLight,
    minWidth: 80,
  },
  labelInput: {
    ...FONTS.body1,
    color: COLORS.textLight,
    marginBottom: SIZES.padding * 0.5,
  },
  value: {
    ...FONTS.body1,
    color: COLORS.text,
    flexShrink: 1,
  },
  input: {
    ...FONTS.body1,
    backgroundColor: COLORS.inputBackground, // Use a specific input background color if defined
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding /2,
    marginBottom: SIZES.padding * 1.5,
    color: COLORS.text,
  },
  button: {
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.padding / 4,
    paddingHorizontal: SIZES.padding * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...FONTS.h4, 
    color: COLORS.white,
    fontWeight: 'bold',
  },
  inputSpacing: { // Added style for spacing between inputs
    marginTop: SIZES.padding * 1.5,
  },
});

export default AccountScreen; 