import { reportToNotion, NotionTicketData } from './notionService';
import { appLogger } from './AppLogService';

interface ErrorReportData {
  title?: string;
  error: any; 
  kitchenName?: string | null;
  userEmail?: string | null;
  clientVersion?: string;
  userId?: string;
  additionalInfo?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  errorMessage?: string;
  errorStack?: string;
  componentName?: string;
}

export interface FeedbackParams {
  title: string;
  feedbackText: string;
  userEmail?: string | null;
  kitchenName?: string | null;
}

export const submitFeedback = async (params: FeedbackParams): Promise<boolean> => {
  const userFeedback = `User Feedback Submitted:\n----------------------\n${params.feedbackText}`;
  const recentAppLogs = appLogger.getlogs(); 
  let combinedLogContent = userFeedback;

  if (recentAppLogs && recentAppLogs.trim() !== '') {
    combinedLogContent += `\n\nRecent Application Logs:\n----------------------\n${recentAppLogs}`;
  }

  const ticketData: NotionTicketData = {
    title: params.title,
    kitchenName: params.kitchenName ?? null,
    userEmail: params.userEmail ?? null,
    logContent: combinedLogContent, 
    logLevel: 'INFO', 
  };
  return await reportToNotion(ticketData);
};

export const submitErrorReport = async (data: ErrorReportData): Promise<boolean> => {
  try {
    const payload: NotionTicketData = {
      title: data.title || `Error Report: ${(data.error?.message || String(data.error)).substring(0, 50)}`,
      error: data.error, 
      logContent: data.error?.stack || String(data.error), 
      kitchenName: data.kitchenName ?? null,
      userEmail: data.userEmail ?? null,
      clientVersion: data.clientVersion ?? null,
      logLevel: data.severity?.toUpperCase() || 'ERROR',
    };

    if (data.additionalInfo) {
      payload.logContent += `\n\nAdditional Info:\n------------------\n${data.additionalInfo}`;
    }

    appLogger.log('Submitting error report with payload:', payload);
    return await reportToNotion(payload);
  } catch (error) {
    appLogger.error('Error submitting error report:', error);
    return false;
  }
};

export const reportError = (componentName: string, userId?: string) => {
  return (error: any, additionalInfo?: string, severity?: ErrorReportData['severity']) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    submitErrorReport({
      error: error, 
      errorMessage,
      errorStack,
      componentName,
      userId,
      additionalInfo,
      severity,
    }).catch(e => {
      appLogger.error('Failed to report error:', e);
    });
    
    return error;
  };
}; 

// DEPRECATED: prefer using globalErrorHandler from `src/services/sentry`
export const globalErrorReporter = (
  error: Error, // Expect an actual Error object
  context?: {
    componentName?: string;
    additionalInfo?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
  }
) => {
  appLogger.error(`Global error in ${context?.componentName || 'unknown component'}:`, error);
  
  let constructedTitle = `FE Error: ${context?.componentName || 'Unknown'} - ${error.message.substring(0,30)}`;
  let constructedAdditionalInfo = `Component: ${context?.componentName || 'N/A'}`;
  if (context?.additionalInfo) {
    constructedAdditionalInfo += `\nContextual Info: ${context.additionalInfo}`;
  }
  // The stack trace is automatically included in payload.logContent by submitErrorReport if error.stack exists

  submitErrorReport({
    error: error, 
    title: constructedTitle,
    additionalInfo: constructedAdditionalInfo,
    severity: context?.severity || 'high',
    userId: context?.userId
    // kitchenName, userEmail, clientVersion can be added here if available from context
  }).catch(e => {
    appLogger.error('Failed to report error via globalErrorReporter:', e);
  });
  
  return error; 
};