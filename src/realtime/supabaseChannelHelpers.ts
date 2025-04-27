import { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Database } from '../data/database.types'; // Adjust path if needed

type TableName = keyof Database['public']['Tables'];

// Use 'any' for records in handlers, caller must handle types
interface SubscriptionHandlers {
    onInsert?: (newRecord: any) => void;
    onUpdate?: (updatedRecord: any) => void;
    onDelete?: (oldRecord: any) => void;
    onError?: (error: Error) => void;
    onSubscribed?: (channel: RealtimeChannel) => void;
}

/**
 * Creates and manages a Supabase Realtime channel subscription for a specific table.
 * NOTE: Event handlers receive records as 'any'. Caller is responsible for type assertion.
 *
 * @param supabase - The initialized Supabase client instance.
 * @param tableName - The name of the table to subscribe to.
 * @param handlers - Callback functions for INSERT, UPDATE, DELETE events.
 * @param filter - Optional filter to apply to the subscription (e.g., `user_id=eq.${userId}`).
 * @returns A function to unsubscribe the channel.
 */
export function subscribeToTable(
    supabase: SupabaseClient<Database>,
    tableName: TableName,
    handlers: SubscriptionHandlers, // Use non-generic handlers type
    filter?: string
): () => Promise<string | void> { 

    const channelName = `public:${tableName}:${filter || 'all'}`;
    console.log(`[Realtime] Attempting to subscribe to channel: ${channelName}`);

    const channel = supabase.channel(channelName);

    channel
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: tableName,
                filter: filter,
            },
            // Use 'any' for payload type, rely on caller to cast/validate
            (payload: RealtimePostgresChangesPayload<any>) => { 
                console.log(`[Realtime] Change received on ${tableName}:`, payload);
                switch (payload.eventType) {
                    case 'INSERT':
                        if (handlers.onInsert && payload.new) {
                            handlers.onInsert(payload.new);
                        }
                        break;
                    case 'UPDATE':
                        if (handlers.onUpdate && payload.new) {
                            handlers.onUpdate(payload.new);
                        }
                        break;
                    case 'DELETE':
                        if (handlers.onDelete && payload.old) {
                            handlers.onDelete(payload.old);
                        }
                        break;
                    default:
                        console.warn(`[Realtime] Unhandled event type: ${payload.eventType}`);
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[Realtime] Successfully subscribed to ${channelName}`);
                if (handlers.onSubscribed) {
                    handlers.onSubscribed(channel);
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                const error = err || new Error(`Channel status: ${status}`);
                console.error(`[Realtime] Subscription error on ${channelName}:`, error);
                if (handlers.onError) {
                    handlers.onError(error);
                }
                // Optionally attempt resubscription here or handle in calling code
            }
        });

    // Return an unsubscribe function
    const unsubscribe = async () => {
        console.log(`[Realtime] Unsubscribing from channel: ${channelName}`);
        // subscription.unsubscribe() is deprecated, use removeChannel()
        return supabase.removeChannel(channel); // Remove the specific channel instance
    };

    return unsubscribe;
} 