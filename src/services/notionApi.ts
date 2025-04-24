import { submitToNotion } from './api';

interface FeedbackData {
  feedbackText: string;
  kitchenName?: string;
  userId?: string;
}

interface ErrorReportData {
  errorMessage: string;
  errorStack?: string | null;
  componentName?: string;
  userId?: string;
  additionalInfo?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export const submitFeedback = async (data: FeedbackData): Promise<boolean> => {
  try {
    const payload = {
      feedbackText: data.feedbackText,
      kitchenName: data.kitchenName || 'Unknown',
      userId: data.userId || 'Anonymous',
      timestamp: new Date().toISOString(),
      isError: false,
      title: `Feedback: ${data.feedbackText.substring(0, 50)}${data.feedbackText.length > 50 ? '...' : ''}`,
    };
    
    return await submitToNotion(payload);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return false;
  }
};

export const submitErrorReport = async (data: ErrorReportData): Promise<boolean> => {
  try {
    const payload = {
      errorMessage: data.errorMessage,
      errorStack: data.errorStack || 'No stack trace available',
      componentName: data.componentName || 'Unknown component',
      userId: data.userId || 'Anonymous',
      additionalInfo: data.additionalInfo || '',
      severity: data.severity || 'medium',
      timestamp: new Date().toISOString(),
      isError: true,
      title: `Error: ${data.errorMessage.substring(0, 50)}${data.errorMessage.length > 50 ? '...' : ''}`,
    };
    
    return await submitToNotion(payload);
  } catch (error) {
    console.error('Error submitting error report:', error);
    return false;
  }
};

// Utility function to create an error handler that can be used in catch blocks
export const reportError = (componentName: string, userId?: string) => {
  return (error: any, additionalInfo?: string, severity?: ErrorReportData['severity']) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    submitErrorReport({
      errorMessage,
      errorStack,
      componentName,
      userId,
      additionalInfo,
      severity,
    }).catch(e => {
      console.error('Failed to report error:', e);
    });
    
    // Return the original error for further handling
    return error;
  };
}; 