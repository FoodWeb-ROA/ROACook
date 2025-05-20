import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { submitErrorReport } from '../services/notionApi';
import { appLogger } from '../services/AppLogService';
import { useAuth } from '../context/AuthContext';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Kitchen } from '../types';
import { reportToNotion } from '../services/notionService';
import { createSelector } from 'reselect';

interface ErrorOptions {
  componentName: string;
  showAlert?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  additionalInfo?: string;
  title?: string;
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
  appLogger.error(`Error in ${options.componentName}:`, errorMessage);
  if (errorStack) appLogger.error(errorStack);
  
  // Report to Notion
  submitErrorReport({
    error: error, // Pass the original error object
    title: options.title || `Error in ${options.componentName}: ${errorMessage.substring(0,30)}`,
    additionalInfo: `Component: ${options.componentName}\nError Message: ${errorMessage}${errorStack ? `\nStack Trace:\n${errorStack}` : ''}${options.additionalInfo ? `\nExtra Info: ${options.additionalInfo}`: ''}`,
    severity: options.severity || 'medium',
  }).catch(reportingError => {
    appLogger.error('Failed to report error to Notion:', reportingError);
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
 * Memoized selector for error reporting context (user/kitchen info).
 */
const selectAuthUser = (state: RootState) => state.auth.user;
const selectKitchensState = (state: RootState) => state.kitchens;

const selectErrorReportingContext = createSelector(
  [selectAuthUser, selectKitchensState],
  (user, kitchensState) => {
    const activeKitchenId = kitchensState.activeKitchenId;
    const activeKitchen = kitchensState.kitchens.find((k: Kitchen) => k.kitchen_id === activeKitchenId);
    return {
      kitchenName: activeKitchen?.name ?? activeKitchenId ?? null,
    };
  }
);

/**
 * React hook for error handling within functional components
 */
export const useErrorHandler = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Use the memoized selector
  const { kitchenName } = useSelector(selectErrorReportingContext);

  const handleError = useCallback(
    (error: unknown, context?: ErrorOptions) => {
      const err = error instanceof Error ? error : new Error(String(error));
      const { componentName, showAlert = false, severity = 'low', additionalInfo, title } = context || {};
    
      // Log the error regardless
      appLogger.error(`[${severity.toUpperCase()}] Error in ${componentName || 'Unknown Component'}:`, err);
      if (additionalInfo) {
        appLogger.error('Additional Info:', additionalInfo);
      }

      // --- Report to Notion --- //
      // Construct log content, including additional info if provided
      let logContent = err.stack || err.toString();
      if (additionalInfo) {
        logContent = `Additional Info: ${additionalInfo}\n\n${logContent}`;
      }
      if (componentName) {
         logContent = `Component: ${componentName}\n${logContent}`;
      }

      reportToNotion({
        error: err,
        logContent: logContent, // Use the combined log content
        kitchenName: kitchenName,
        userMessage: `Automatic Error Report [${severity}]`, // Add severity to message
      });
      // ---------------------- //

      if (showAlert) {
      Alert.alert(
          t('common.error'), // Generic error title
          t('errors.genericMessage') // User-friendly generic message
          // Optionally provide more details based on severity or context
          // `err.message` - might be too technical for users
      );
    }
    },
    [t, kitchenName] // Add dependencies
  );
  
  return { handleError };
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

/**
 * @deprecated Prefer using globalErrorHandler from `src/services/sentry` for more robust error tracking.
 */