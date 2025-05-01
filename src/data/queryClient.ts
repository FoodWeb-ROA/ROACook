import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton instance of QueryClient for TanStack Query.
 * Configured with default garbage collection and stale times.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection time
      // Increase staleTime as realtime updates keep data fresh
      staleTime: 1000 * 60 * 30, // 30 minutes
    },
  },
}); 