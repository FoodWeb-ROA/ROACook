'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode } from 'react';

// Declare queryClient on window for global access (e.g., from sagas)
// Consider a more robust dependency injection approach for larger apps.
declare global {
  interface Window {
    queryClient: QueryClient;
  }
}

// Create QueryClient instance (ensure this runs only once)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection time
      staleTime: 1000 * 60 * 5, // 5 minutes before data is considered stale
    },
  },
});

// Create AsyncStorage persister
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000, // Persist throttling (ms)
  key: 'rq-cache', // Cache key in AsyncStorage
});

export const ReactQueryClientProvider = ({ children }: { children: ReactNode }) => {
  // Expose client for sagas (only in development/client-side)
  if (typeof window !== 'undefined') {
     window.queryClient = queryClient;
  }

  return (
    // Use PersistQueryClientProvider to enable offline caching
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      {children}
    </PersistQueryClientProvider>
    // Original non-persisted setup:
    // <QueryClientProvider client={queryClient}>
    //   {children}
    // </QueryClientProvider>
  );
}; 