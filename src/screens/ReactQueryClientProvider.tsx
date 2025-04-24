'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

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
          },
        },
      })
  );

  // Expose client for sagas
  (window as any).queryClient = queryClient;


  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}; 