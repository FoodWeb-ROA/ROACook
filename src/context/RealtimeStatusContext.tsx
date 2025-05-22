import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabaseRealtime } from '../realtime/useSupabaseRealtime';
import { appLogger } from '../services/AppLogService';

export type RealtimeStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'INITIALIZING';

interface RealtimeStatusContextType {
  status: RealtimeStatus;
  error: string | null;
  isAttemptingRetry: boolean;
}

const RealtimeStatusContext = createContext<RealtimeStatusContextType | undefined>(undefined);

export const useRealtimeStatus = () => {
  const context = useContext(RealtimeStatusContext);
  if (context === undefined) {
    throw new Error('useRealtimeStatus must be used within a RealtimeStatusProvider');
  }
  return context;
};

interface RealtimeStatusProviderProps {
  children: ReactNode;
}

export const RealtimeStatusProvider: React.FC<RealtimeStatusProviderProps> = ({ children }) => {
  const { isConnected, error: supabaseError, retryAttempt, isSubscribing } = useSupabaseRealtime();
  const [status, setStatus] = useState<RealtimeStatus>('INITIALIZING');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let newStatus: RealtimeStatus = 'INITIALIZING';
    let newError: string | null = null;

    if (isSubscribing) {
      newStatus = 'CONNECTING';
    } else if (isConnected) {
      newStatus = 'CONNECTED';
    } else if (supabaseError) {
      newStatus = 'ERROR';
      newError = supabaseError.message || 'An unknown realtime error occurred.';
    } else {
      // If not connected, not subscribing, and no specific error, assume disconnected
      // This can happen if the channel closes without an explicit error being thrown by subscribe() callback
      // or if the initial conditions (activeKitchenId, userId) are not met.
      newStatus = 'DISCONNECTED'; 
    }
    
    // Prevent unnecessary state updates if status hasn't changed
    if (newStatus !== status || newError !== error) {
        appLogger.log(`[RealtimeStatusProvider] Status change: ${status} -> ${newStatus}, Error: ${error} -> ${newError}, Retry Attempt: ${retryAttempt}`);
        setStatus(newStatus);
        setError(newError);
    }

  }, [isConnected, supabaseError, isSubscribing, retryAttempt, status, error]);

  return (
    <RealtimeStatusContext.Provider value={{ status, error, isAttemptingRetry: retryAttempt > 0 && status !== 'CONNECTED' }}>
      {children}
    </RealtimeStatusContext.Provider>
  );
};
