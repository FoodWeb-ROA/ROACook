import React, { useState, useMemo } from 'react';
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
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { appLogger } from '../services/AppLogService';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { submitFeedback } from '../services/notionApi';
import { useErrorHandler } from '../utils/errorReporting';
import { RootState } from '../store';
import { Kitchen } from '../types';

type HelpScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HelpScreen'>;

const HelpScreen = () => {
  const navigation = useNavigation<HelpScreenNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  
  const [subject, setSubject] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Character limits
  const SUBJECT_LIMIT = 50;
  const FEEDBACK_LIMIT = 500;
  
  // Calculate remaining characters
  const subjectRemaining = useMemo(() => SUBJECT_LIMIT - subject.length, [subject]);
  const feedbackRemaining = useMemo(() => FEEDBACK_LIMIT - feedback.length, [feedback]);

  // Get active kitchen name from Redux store
  const activeKitchenName = useSelector((state: RootState) => {
    const kitchensState = state.kitchens;
    const activeKitchenId = kitchensState.activeKitchenId;
    const activeKitchen = kitchensState.kitchens.find((k: Kitchen) => k.kitchen_id === activeKitchenId);
    return activeKitchen?.name ?? activeKitchenId ?? 'N/A'; // Fallback to ID or N/A
  });

  // Function to submit feedback
  const userEmail = useSelector((state: RootState) => state.auth.user?.user_email ?? null);

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert(t('screens.help.errorTitle'), 'Please enter your feedback');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitFeedback({
        title: subject || 'General Feedback',
        feedbackText: feedback,
        userEmail: userEmail,
        kitchenName: activeKitchenName,
      });

      if (result) {
        setSubject('');
        Alert.alert(
          t('screens.help.successTitle'),
          t('screens.help.successMessage')
        );
        setFeedback('');
        
        // Clear logs after successful submission to avoid duplicate logs in future feedback
        appLogger.clearLogs();
        
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
            
            <Text style={styles.label}>{t('screens.help.subjectLabel') || 'Subject'}</Text>
            <View>
              <TextInput
                style={styles.input}
                placeholder={t('screens.help.subjectPlaceholder') || 'Subject'}
                value={subject}
                onChangeText={(text) => {
                  if (text.length <= SUBJECT_LIMIT) {
                    setSubject(text);
                  }
                }}
                maxLength={SUBJECT_LIMIT}
              />
              <Text style={styles.charCounter}>{subjectRemaining} {t('screens.help.charsRemaining') || 'characters remaining'}</Text>
            </View>
            
            <Text style={styles.label}>{t('screens.help.feedbackLabel')}</Text>
            <View>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                placeholder={t('screens.help.feedbackPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={feedback}
                onChangeText={(text) => {
                  if (text.length <= FEEDBACK_LIMIT) {
                    setFeedback(text);
                  }
                }}
                maxLength={FEEDBACK_LIMIT}
              />
              <Text style={styles.charCounter}>{feedbackRemaining} {t('screens.help.charsRemaining') || 'characters remaining'}</Text>
            </View>
            
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
    padding: 20,
  },
  sectionTitle: {
    color: COLORS.text,
    marginBottom: 15,
    fontSize: 20,
    fontFamily: 'Poppins',
    fontWeight: 'bold',
  },
  label: {
    color: COLORS.text,
    marginBottom: 8,
    fontSize: 16,
    fontFamily: 'Poppins',
    fontWeight: '500', // medium
    marginTop: 15,
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontFamily: 'Poppins',
    fontWeight: 'normal', // regular
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    fontFamily: 'Poppins',
    fontWeight: 'normal', // regular
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: 'Poppins',
    fontWeight: '600', // semi-bold
  },
  charCounter: {
    color: COLORS.textLight,
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginRight: 5,
    fontFamily: 'Poppins',
  },
});

export default HelpScreen;