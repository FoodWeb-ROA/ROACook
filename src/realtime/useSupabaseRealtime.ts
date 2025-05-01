import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

import { supabase } from '../data/supabaseClient';
import { queryClient } from '../data/queryClient';
import { RootState } from '../store'; 
import { applyRealtimeEvent } from './cacheInvalidation';

// Define generic payload type for clarity
type SupabasePayload = RealtimePostgresChangesPayload<{ [key: string]: any }>;

// List of tables to subscribe to
const WATCHED_TABLES = [
    'kitchen', 
    'kitchen_users', 
    'dishes', 
    'ingredients', 
    'preparations', 
    'preparation_ingredients',
    'menu_section',
    'dish_components'
];

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Hook to manage Supabase Realtime subscriptions for the active kitchen.
 * It subscribes to changes in relevant tables and updates the React Query cache.
 */
export function useSupabaseRealtime() {
    const activeKitchenId = useSelector((state: RootState) => state.kitchens.activeKitchenId);
    const user = useSelector((state: RootState) => state.auth.user);
    const userId = user?.user_id;
    const channelRef = useRef<RealtimeChannel | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const retryAttemptRef = useRef<number>(0);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const clearRetryTimer = () => {
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
    };

    const attemptSubscription = (isRetry = false) => {
        // Ensure cleanup of any existing channel/timer before attempting
        clearRetryTimer();
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
            setIsConnected(false);
        }
        setError(null); // Clear previous error on new attempt

        if (!activeKitchenId || !userId) {
            console.log('[useSupabaseRealtime] Cannot subscribe: Missing kitchen or user ID.');
            return; // Don't attempt if conditions not met
        }

        if (isRetry) {
            retryAttemptRef.current += 1;
            console.log(`[useSupabaseRealtime] Retrying subscription (Attempt ${retryAttemptRef.current}/${MAX_RETRY_ATTEMPTS})...`);
        } else {
            retryAttemptRef.current = 0; // Reset attempts on manual trigger
        }

        const channelName = `kitchen-${activeKitchenId}`;
        console.log(`[useSupabaseRealtime] Attempting to subscribe to channel: ${channelName}`);
        const newChannel = supabase.channel(channelName);

        // Event listeners (same as before)
        WATCHED_TABLES.forEach(table =>
            newChannel.on<
                RealtimePostgresChangesPayload<any>
            >(
                'postgres_changes',
                { event: '*', schema: 'public', table: table },
                (payload: SupabasePayload) => {
                    applyRealtimeEvent(payload, queryClient, userId, activeKitchenId);
                }
            )
        );

        // Subscription status handler
        newChannel.subscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
            if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
                console.log(`[useSupabaseRealtime] Successfully subscribed to ${channelName}`);
                setIsConnected(true);
                setError(null);
                retryAttemptRef.current = 0; // Reset retries on success
                clearRetryTimer(); // Clear any pending retry timers
            } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
                console.error(`[useSupabaseRealtime] Subscription error on ${channelName}:`, status, err);
                setIsConnected(false);
                const currentError = err || new Error(`Subscription failed with status: ${status}`);
                setError(currentError);
                channelRef.current = null; // Channel is likely unusable

                // Schedule retry if attempts remaining
                if (retryAttemptRef.current < MAX_RETRY_ATTEMPTS) {
                    const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryAttemptRef.current);
                    console.log(`[useSupabaseRealtime] Scheduling retry in ${delay}ms...`);
                    clearRetryTimer(); // Clear previous timer just in case
                    retryTimeoutRef.current = setTimeout(() => attemptSubscription(true), delay);
                } else {
                    console.error(`[useSupabaseRealtime] Max retry attempts reached for channel ${channelName}.`);
                    clearRetryTimer();
                }
            } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
                console.log(`[useSupabaseRealtime] Subscription closed for ${channelName}.`);
                // Only set disconnected if it wasn't already handled by an error state
                if (!error) {
                    setIsConnected(false);
                }
                 // Don't automatically retry on manual close or unexpected close without error
                 clearRetryTimer(); 
            }
        });

        channelRef.current = newChannel;
    };

    useEffect(() => {
        console.log('[useSupabaseRealtime] Effect triggered. Kitchen:', activeKitchenId, 'User:', userId);
        // Start the initial subscription attempt
        attemptSubscription();

        // Cleanup function: Remove channel and clear timers
        return () => {
            console.log('[useSupabaseRealtime] Cleanup effect');
            clearRetryTimer();
            if (channelRef.current) {
                console.log(`[useSupabaseRealtime] Unsubscribing from ${channelRef.current.topic}`);
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            setIsConnected(false);
            setError(null);
            retryAttemptRef.current = 0;
        };

    // Dependencies: Re-run effect if kitchen ID or user ID changes
    }, [activeKitchenId, userId]);

    return { isConnected, error };
} 