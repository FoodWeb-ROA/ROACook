'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Declare queryClient on window for global access (e.g., from sagas)
// Consider a more robust dependency injection approach for larger apps.
declare global {
  interface Window {
    queryClient: QueryClient;
  }
}

export const ReactQueryClientProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Configure default staleTime and gcTime (formerly cacheTime)
            // staleTime: Time data is considered fresh before becoming stale (ms)
            // gcTime: Time inactive query data remains in memory (ms)
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            retry: 1, // Retry failed requests once
            networkMode: 'offlineFirst',
          },
          mutations: {
            networkMode: 'offlineFirst',
          },
        },
      })
  );

  // Expose client for sagas (only in development/client-side)
  if (typeof window !== 'undefined') {
     window.queryClient = queryClient;
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}; 