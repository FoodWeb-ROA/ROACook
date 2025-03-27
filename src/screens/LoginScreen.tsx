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
import { KITCHENS } from '../constants/dummyData';
import { useAuth } from '../context/AuthContext';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // Validate input
    if (email.trim() === '' || password.trim() === '') {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      const { error } = await signIn(email, password);
      
      if (error) {
        Alert.alert('Login Failed', error.message || 'Please check your credentials and try again');
      }
      // No need to navigate - AppNavigator will handle this automatically when user state changes
    } catch (error) {
      Alert.alert('Login Error', 'An unexpected error occurred');
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
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1050&q=80' }}
      style={styles.backgroundImage}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <MaterialCommunityIcons name="chef-hat" size={60} color={COLORS.white} />
              <Text style={styles.title}>Chef's Recipes</Text>
              <Text style={styles.subtitle}>Restaurant Recipe Management</Text>
            </View>
            
            <View style={styles.formContainer}>
              {showSearch ? (
                <View style={styles.searchContainer}>
                  <Text style={styles.formLabel}>Find Your Kitchen</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Search kitchen by name or location"
                    placeholderTextColor={COLORS.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  
                  {searchQuery.length > 0 && (
                    <View style={styles.resultsContainer}>
                      {filteredKitchens.length > 0 ? (
                        filteredKitchens.map(kitchen => (
                          <TouchableOpacity 
                            key={kitchen.id} 
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
                        <Text style={styles.noResults}>No kitchens found</Text>
                      )}
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setShowSearch(false)}
                  >
                    <Text style={styles.backButtonText}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.formLabel}>Login to your kitchen</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity 
                    style={[styles.loginButton, isLoading && styles.disabledButton]}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.loginButtonText}>Login</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.searchKitchenButton}
                    onPress={() => setShowSearch(true)}
                    disabled={isLoading}
                  >
                    <Text style={styles.searchKitchenText}>Search for kitchen</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  keyboardAvoidView: {
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
  searchKitchenButton: {
    padding: SIZES.padding,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  searchKitchenText: {
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