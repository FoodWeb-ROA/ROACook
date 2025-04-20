import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ImageBackground,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async () => {
    // Validate input
    if (email.trim() === '' || password.trim() === '') {
      Alert.alert(t('common.error'), t('screens.login.validation.emailPasswordRequired'));
      return;
    }
    
    try {
      setIsLoading(true);
      const { error } = await signIn(email, password);
      
      if (error) {
        Alert.alert(t('screens.login.loginFailedTitle'), error.message || t('screens.login.loginFailedDefaultMessage'));
      }
      // No need to navigate - AppNavigator will handle this automatically when user state changes
    } catch (error) {
      Alert.alert(t('screens.login.loginErrorTitle'), t('screens.login.unexpectedError'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    // Validate input for sign up
    if (email.trim() === '' || password.trim() === '' || username.trim() === '') {
      Alert.alert(t('common.error'), t('screens.login.validation.allFieldsRequired'));
      return;
    }
    
    // Validate password length
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('screens.login.validation.passwordLength'));
      return;
    }
    
    try {
      setIsLoading(true);
      const { error, user } = await signUp(email, password, username);
      
      if (error) {
        Alert.alert(t('screens.login.signUpFailedTitle'), error.message || t('screens.login.signUpFailedDefaultMessage'));
      } else {
        Alert.alert(
          t('screens.login.signUpSuccessTitle'), 
          t('screens.login.signUpSuccessMessage'),
          [{ text: t('common.ok', 'OK'), onPress: () => setIsSignUp(false) }]
        );
        // Clear form
        setUsername('');
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      Alert.alert(t('screens.login.signUpErrorTitle'), t('screens.login.unexpectedError'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredKitchens = KITCHENS.filter(kitchen => 
    kitchen.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kitchen.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaViewContext style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <MaterialCommunityIcons name="chef-hat" size={60} color={COLORS.white} />
            <Text style={styles.title}>{t('screens.login.title')}</Text>
            <Text style={styles.subtitle}>{t('screens.login.subtitle')}</Text>
          </View>
          
          <View style={styles.formContainer}>
            {showSearch ? (
              <View style={styles.searchContainer}>
                <Text style={styles.formLabel}>{t('screens.login.findKitchenLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('screens.login.searchKitchenPlaceholder')}
                  placeholderTextColor={COLORS.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                
                {searchQuery.length > 0 && (
                  <View style={styles.resultsContainer}>
                    {filteredKitchens.length > 0 ? (
                      filteredKitchens.map(kitchen => (
                        <TouchableOpacity 
                          key={kitchen.name}
                          style={styles.resultItem}
                          onPress={() => {
                            setSearchQuery(kitchen.name);
                            setShowSearch(false);
                          }}
                        >
                          <Text style={styles.resultItemName}>{kitchen.name}</Text>
                          <Text style={styles.resultItemLocation}>{kitchen.location}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.noResults}>{t('screens.login.noKitchensFound')}</Text>
                    )}
                  </View>
                )}
                
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => setShowSearch(false)}
                >
                  <Text style={styles.backButtonText}>{t('screens.login.backToLogin')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.formLabel}>
                  {isSignUp ? t('screens.login.createAccountLabel') : t('screens.login.loginToKitchenLabel')}
                </Text>
                
                {isSignUp && (
                  <TextInput
                    style={styles.input}
                    placeholder={t('screens.login.usernamePlaceholder')}
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                  />
                )}
                
                <TextInput
                  style={styles.input}
                  placeholder={t('screens.login.emailPlaceholder')}
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                
                <TextInput
                  style={styles.input}
                  placeholder={t('screens.login.passwordPlaceholder')}
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                
                <TouchableOpacity 
                  style={[styles.loginButton, isLoading && styles.disabledButton]}
                  onPress={isSignUp ? handleSignUp : handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {isSignUp ? t('screens.login.signUpButton') : t('screens.login.loginButton')}
                    </Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.toggleButton}
                  onPress={() => setIsSignUp(!isSignUp)}
                >
                  <Text style={styles.toggleButtonText}>
                    {isSignUp ? t('screens.login.alreadyHaveAccount') : t('screens.login.dontHaveAccount')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaViewContext>
  );
};

interface Kitchen {
  name: string;
  location: string;
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.padding * 3,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: SIZES.padding,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.white,
    marginTop: SIZES.base,
  },
  formContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  formLabel: {
    ...FONTS.h3,
    marginBottom: SIZES.padding,
    textAlign: 'center',
    color: COLORS.white,
  },
  input: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.white,
  },
  loginButton: {
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    padding: SIZES.padding,
    alignItems: 'center',
    marginTop: SIZES.padding / 2,
  },
  toggleButtonText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    width: '100%',
  },
  resultsContainer: {
    marginTop: SIZES.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    maxHeight: 200,
    backgroundColor: COLORS.secondary,
  },
  resultItem: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  resultItemLocation: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  noResults: {
    padding: SIZES.padding,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  backButton: {
    padding: SIZES.padding,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  backButtonText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
  },
});

export default LoginScreen;