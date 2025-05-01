'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode } from 'react';

// Import the shared instance
import { queryClient } from '../data/queryClient';

// Create AsyncStorage persister
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000, // Persist throttling (ms)
  key: 'rq-cache', // Cache key in AsyncStorage
});

export const ReactQueryClientProvider = ({ children }: { children: ReactNode }) => {
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