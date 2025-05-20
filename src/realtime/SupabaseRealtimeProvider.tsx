import React, { createContext, useContext } from 'react';
import { useSupabaseRealtime } from './useSupabaseRealtime';

interface RealtimeContextType {
    isConnected: boolean;
    error: Error | null;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

/**
 * Provider component that initializes the Supabase Realtime listener.
 * It also provides the connection status and any errors via context.
 */
export const SupabaseRealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isConnected, error } = useSupabaseRealtime();

    // Optionally, display connection status/errors globally here or via context consumers
    // Example:
    // if (error) { appLogger.error("Realtime connection error:", error); }
    // if (!isConnected) { appLogger.log("Realtime disconnected."); }

    const contextValue = { isConnected, error };

    return (
        <RealtimeContext.Provider value={contextValue}>
            {children}
        </RealtimeContext.Provider>
    );
};

/**
 * Hook to access the Supabase Realtime connection status and error.
 */
export const useRealtimeStatus = () => {
    const context = useContext(RealtimeContext);
    if (context === undefined) {
        throw new Error('useRealtimeStatus must be used within a SupabaseRealtimeProvider');
    }
    return context;
}; 