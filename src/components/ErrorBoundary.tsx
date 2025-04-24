import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { submitErrorReport } from '../services/notionApi';

interface Props {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Report the error to Notion
    submitErrorReport({
      errorMessage: error.message,
      // Only pass the stack if it exists
      errorStack: typeof error.stack === 'string' ? error.stack : undefined,
      componentName: this.props.componentName || 'Unknown',
      additionalInfo: errorInfo.componentStack,
      severity: 'high', // React errors that crash components are considered high severity
    }).catch(reportingError => {
      console.error('Failed to report error to Notion:', reportingError);
    });
    
    // You can also log the error to an error reporting service
    console.error('Uncaught error:', error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.resetError}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
    backgroundColor: COLORS.background,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.error,
    marginBottom: SIZES.padding,
  },
  message: {
    ...FONTS.body2,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SIZES.padding * 2,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  buttonText: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: 'bold',
  },
});

export default ErrorBoundary; 