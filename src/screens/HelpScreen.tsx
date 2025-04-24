import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { submitFeedback } from '../services/notionApi';
import { useErrorHandler } from '../utils/errorReporting';

type HelpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpScreen'>;

const HelpScreen = () => {
  const navigation = useNavigation<HelpScreenNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to submit feedback
  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert(t('screens.help.errorTitle'), 'Please enter your feedback');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitFeedback({
        feedbackText: feedback,
        userId: user?.id,
        kitchenName: 'ROACook Kitchen', // This could come from app settings in a real app
      });

      if (result) {
        Alert.alert(
          t('screens.help.successTitle'),
          t('screens.help.successMessage')
        );
        setFeedback('');
        
        // Navigate back after successful submission
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      handleError(error, {
        componentName: 'HelpScreen',
        showAlert: true,
        severity: 'medium',
        additionalInfo: 'Error occurred while submitting user feedback'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader
        title={t('screens.help.title')}
        showBackButton={true}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
      >
        <ScrollView style={styles.container}>
          <View style={styles.contentContainer}>
            <Text style={styles.sectionTitle}>{t('screens.help.feedbackTitle')}</Text>
            
            <Text style={styles.label}>{t('screens.help.feedbackLabel')}</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder={t('screens.help.feedbackPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              value={feedback}
              onChangeText={setFeedback}
            />
            
            <TouchableOpacity
              style={[styles.submitButton, !feedback.trim() && styles.submitButtonDisabled]}
              onPress={handleSubmitFeedback}
              disabled={isSubmitting || !feedback.trim()}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>{t('screens.help.submitButton')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: SIZES.padding * 2,
  },
  sectionTitle: {
    ...FONTS.h2,
    color: COLORS.white,
    marginBottom: SIZES.padding * 1.5,
  },
  label: {
    ...FONTS.body2,
    color: COLORS.white,
    marginBottom: SIZES.base,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 120,
    ...FONTS.body2,
    marginBottom: SIZES.padding * 2,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    paddingVertical: SIZES.padding,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  submitButtonText: {
    ...FONTS.h3,
    color: COLORS.white,
  },
});

export default HelpScreen; 