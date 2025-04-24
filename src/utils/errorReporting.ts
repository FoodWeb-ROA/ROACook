import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { submitErrorReport } from '../services/notionApi';
import { useAuth } from '../context/AuthContext';

interface ErrorOptions {
  componentName: string;
  showAlert?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  additionalInfo?: string;
}

/**
 * Global error handler function - for use outside of React components
 */
export const handleError = (
  error: Error | unknown,
  options: ErrorOptions
) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Log to console for development
  console.error(`Error in ${options.componentName}:`, errorMessage);
  if (errorStack) console.error(errorStack);
  
  // Report to Notion
  submitErrorReport({
    errorMessage,
    errorStack,
    componentName: options.componentName,
    additionalInfo: options.additionalInfo,
    severity: options.severity || 'medium',
  }).catch(reportingError => {
    console.error('Failed to report error to Notion:', reportingError);
  });
  
  // Show alert if requested
  if (options.showAlert) {
    Alert.alert(
      'Error',
      `An error occurred: ${errorMessage}`,
      [{ text: 'OK' }]
    );
  }
  
  return error;
};

/**
 * React hook for error handling within functional components
 */
export const useErrorHandler = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const handleComponentError = (
    error: Error | unknown,
    options: Omit<ErrorOptions, 'componentName'> & { componentName?: string }
  ) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const componentName = options.componentName || 'UnknownComponent';
    
    // Log to console for development
    console.error(`Error in ${componentName}:`, errorMessage);
    if (errorStack) console.error(errorStack);
    
    // Report to Notion
    submitErrorReport({
      errorMessage,
      errorStack,
      componentName,
      userId: user?.id,
      additionalInfo: options.additionalInfo,
      severity: options.severity || 'medium',
    }).catch(reportingError => {
      console.error('Failed to report error to Notion:', reportingError);
    });
    
    // Show alert if requested
    if (options.showAlert) {
      Alert.alert(
        t('common.error'),
        `${t('screens.login.unexpectedError')}: ${errorMessage}`,
        [{ text: t('common.ok') }]
      );
    }
    
    return error;
  };
  
  return { handleError: handleComponentError };
};

/**
 * Create a higher-order function to handle API call errors
 */
export const createErrorHandler = (componentName: string) => {
  return async <T>(promise: Promise<T>, options: Omit<ErrorOptions, 'componentName'> = {}): Promise<T> => {
    try {
      return await promise;
    } catch (error) {
      handleError(error, {
        componentName,
        ...options
      });
      throw error; // Re-throw the error for the caller to handle
    }
  };
};

/**
 * Utility function to wrap async functions with error handling
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ErrorOptions
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) => {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, options);
      throw error; // Re-throw the error for the caller to handle
    }
  };
}; 