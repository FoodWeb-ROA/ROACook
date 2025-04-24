import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { eventChannel, EventChannel, END } from 'redux-saga';
import { call, fork, select, take, cancel, cancelled, put, delay } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { QueryClient } from '@tanstack/react-query';
import { getKitchensForUserQuery } from '../../queries/kitchenQueries';
import { RootState } from '../../store';
import { IUser } from '../../types';
import { setActiveKitchen } from '../../slices/kitchensSlice';
import { logoutSuccess } from '../../slices/authSlice';

// Helper to get the queryClient instance
function* getQueryClientInstance(): Generator<any, QueryClient, any> {
  const queryClient = (window as any).queryClient as QueryClient;
  if (!queryClient) {
    throw new Error('QueryClient not found on window object');
  }
  return queryClient;
}

// Saga worker to handle realtime events
function* handleRealtimeEvents(channel: EventChannel<any>): Generator<any, void, any> {
  const queryClient: QueryClient = yield call(getQueryClientInstance);
  const user: IUser | null = yield select((state: RootState) => state.auth.user);
  const userId = user?.user_id;

  // Add new tables to the list of watched tables
  const watchedTables = [
    'kitchen', 
    'kitchen_users', 
    'dishes', 
    'ingredients', 
    'preparations', 
    'preparation_ingredients',
    'menu_section',
    'dish_components'
  ];

  while (true) {
    try {
      const payload = yield take(channel);
      console.log('[RealtimeSaga] Received payload:', payload);

      if (!payload || !payload.table || !watchedTables.includes(payload.table)) {
        console.log('[RealtimeSaga] Ignoring payload for unwatched table or invalid payload:', payload);
        continue;
      }

      const tableName = payload.table;
      let queryKeyPrefixToInvalidate: unknown[] | undefined;
      let additionalInvalidations: unknown[][] = [];

      // Determine invalidation strategy based on table
      switch (tableName) {
        case 'kitchen':
        case 'kitchen_users':
          if (userId) {
            queryKeyPrefixToInvalidate = ['kitchen_users', `user_id=eq.${userId}`];
          } else {
            queryKeyPrefixToInvalidate = ['kitchen_users']; 
          }
          break;
        case 'dishes':
          queryKeyPrefixToInvalidate = ['dishes'];
          additionalInvalidations.push(['menu_section']);
          break;
        case 'ingredients':
          queryKeyPrefixToInvalidate = ['ingredients'];
          additionalInvalidations.push(['dishes'], ['preparations']);
          break;
        case 'preparations':
          queryKeyPrefixToInvalidate = ['preparations'];
          additionalInvalidations.push(['ingredients'], ['dishes']);
          break;
        case 'preparation_ingredients':
          queryKeyPrefixToInvalidate = ['preparations'];
          additionalInvalidations.push(['ingredients'], ['dishes']);
          break;
        case 'menu_section':
          queryKeyPrefixToInvalidate = ['menu_section'];
          additionalInvalidations.push(['dishes']);
          break;
        case 'dish_components':
          queryKeyPrefixToInvalidate = ['dishes'];
          additionalInvalidations.push(['ingredients']); 
          break;
        default:
          console.warn(`[RealtimeSaga] Unhandled table change: ${tableName}`);
          break;
      }

      if (queryKeyPrefixToInvalidate) {
        console.log(`[RealtimeSaga] Invalidating primary queryKey prefix for table ${tableName}:`, queryKeyPrefixToInvalidate);
        yield call([queryClient, queryClient.invalidateQueries], { queryKey: queryKeyPrefixToInvalidate });
      }

      for (const additionalKey of additionalInvalidations) {
         console.log(`[RealtimeSaga] Invalidating additional queryKey prefix due to ${tableName} change:`, additionalKey);
         yield call([queryClient, queryClient.invalidateQueries], { queryKey: additionalKey });
      }

    } catch (err) {
      console.error('[RealtimeSaga] Error processing realtime event:', err);
      if (err instanceof Error && err.message.includes('Subscription failed')) {
        console.log('[RealtimeSaga] Subscription error detected, stopping event handling for this channel.');
        return; 
      }
    }
  }
}

// Saga to manage the subscription channel for a specific kitchen
function* manageSubscription(kitchenId: string): Generator<any, void, any> {
  let realtimeChannel: RealtimeChannel | null = null;

  if (!kitchenId) {
    console.warn('[RealtimeSaga] No active kitchen ID provided, skipping subscription.');
    return; // Do not subscribe if no kitchen is active
  }

  // Use kitchenId for the channel name
  const channelName = `kitchen-${kitchenId}`;
  console.log(`[RealtimeSaga] Attempting to subscribe to channel: ${channelName}`);

  const createSubscriptionChannel = () => {
    return eventChannel((emitter: (input: RealtimePostgresChangesPayload<any> | Error | typeof END) => void) => {
      realtimeChannel = supabase.channel(channelName)
        // Add explicit type for payload in listeners
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_users' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'preparations' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'preparation_ingredients' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_section' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_components' }, (payload: RealtimePostgresChangesPayload<any>) => emitter(payload))
        .subscribe((status: RealtimeChannel['state'], err?: Error) => { 
          if (status === 'SUBSCRIBED') {
            console.log(`[RealtimeSaga] Channel ${channelName} successfully subscribed!`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const errorMsg = `[RealtimeSaga] Channel ${channelName} subscription error: ${status}`;
            console.error(errorMsg, err || '');
            emitter(new Error(errorMsg));
            emitter(END);
          } else if (status === 'CLOSED') {
            console.log(`[RealtimeSaga] Channel ${channelName} subscription closed.`);
            emitter(END);
          }
        });

      // Unsubscribe function
      return () => {
        if (realtimeChannel) {
          const chan = realtimeChannel; 
          realtimeChannel = null; 
          console.log(`[RealtimeSaga] Unsubscribing from channel ${chan.topic}...`);
          supabase.removeChannel(chan)
            .then(() => console.log(`[RealtimeSaga] Successfully removed channel ${chan.topic}`))
            .catch((error: Error) => console.error(`[RealtimeSaga] Error removing channel ${chan.topic}:`, error));
        }
      };
    });
  };

  const channel: EventChannel<any> = yield call(createSubscriptionChannel);

  try {
    yield call(handleRealtimeEvents, channel);
  } catch(e) {
     console.error(`[RealtimeSaga] Error in handleRealtimeEvents for channel ${channelName}`, e);
  } finally {
    console.log(`[RealtimeSaga] Subscription management ended for channel ${channelName}. Ensuring channel is closed.`);
    channel.close();
    if (realtimeChannel) {
       console.warn(`[RealtimeSaga] Forcing removal of Supabase channel ${realtimeChannel.topic} in finally block`);
       yield call([supabase, supabase.removeChannel], realtimeChannel); 
    }
    if (yield cancelled()) {
       console.log(`[RealtimeSaga] Task for channel ${channelName} cancelled.`);
    }
  }
}

// Watcher saga: Manages the lifecycle based on active kitchen ID
export function* watchKitchensRealtime(): Generator<any, void, any> {
  let subscriptionTask: any = null; // Store the currently running subscription task

  while (true) {
    // Wait for either a kitchen change or logout
    const action: { type: string, payload?: string } = yield take([
       setActiveKitchen.type, 
       logoutSuccess.type
    ]); 

    // 1. Cancel previous subscription task if it exists
    if (subscriptionTask) {
      console.log(`[RealtimeSaga Watcher] Cancelling previous subscription task...`);
      yield cancel(subscriptionTask);
      subscriptionTask = null;
    }

    // 2. If logged out, stop here and wait for next login/kitchen change
    if (action.type === logoutSuccess.type) {
       console.log(`[RealtimeSaga Watcher] User logged out, stopping subscriptions.`);
       continue; // Go back to waiting for setActiveKitchen or logout
    }

    // 3. Get the new active kitchen ID (handle potential undefined payload)
    const newKitchenId = action.payload;
    if (!newKitchenId || typeof newKitchenId !== 'string') {
      console.warn('[RealtimeSaga Watcher] setActiveKitchen dispatched without valid string payload, cannot subscribe.', action.payload);
      continue;
    }
    console.log(`[RealtimeSaga Watcher] Active kitchen changed to: ${newKitchenId}. Starting subscription.`);
    
    // 4. Fork a new subscription task for the new kitchen ID
    subscriptionTask = yield fork(manageSubscription, newKitchenId);
  }
} 