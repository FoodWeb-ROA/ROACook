import { Client } from '@notionhq/client';
import Constants from 'expo-constants';
import { reportToNotion, NotionTicketData } from './notionService';

const notionApiKey = process.env.EXPO_PUBLIC_NOTION_API_KEY;
const notionDatabaseId = process.env.EXPO_PUBLIC_NOTION_DATABASE_ID;

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

interface FeedbackParams {
  feedbackText: string;
  userId?: string;
  kitchenName?: string;
}

export const submitFeedback = async (params: FeedbackParams): Promise<boolean> => {
  const ticketData: NotionTicketData = {
    userMessage: params.feedbackText,
    userName: params.userId ?? 'Anonymous',
    kitchenName: params.kitchenName ?? 'N/A',
    logContent: `User Feedback Submitted:\n----------------------\n${params.feedbackText}`,
    };
    
  return await reportToNotion(ticketData);
};

export const submitErrorReport = async (data: ErrorReportData): Promise<boolean> => {
  try {
    const payload: NotionTicketData = {
      userName: data.userId ?? 'System',
      kitchenName: 'N/A',
      userMessage: `Error Report [${data.severity}]: ${data.errorMessage}`,
      error: new Error(data.errorMessage),
      logContent: `Component: ${data.componentName ?? 'Unknown'}\nSeverity: ${data.severity ?? 'medium'}\nAdditional Info: ${data.additionalInfo ?? 'None'}\n\nStack Trace:\n${data.errorStack ?? 'Not available'}`,
    };
    
    return await reportToNotion(payload);
  } catch (error) {
    console.error('Error submitting error report:', error);
    return false;
  }
};

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
    
    return error;
  };
}; 