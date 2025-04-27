import { Action } from '@reduxjs/toolkit';
import { call, fork, select, take, cancel, cancelled, StrictEffect } from 'redux-saga/effects';
import { QueryClient } from '@tanstack/react-query';

import { supabase } from '../../data/supabaseClient';
import { subscribeToTable } from '../../realtime/supabaseChannelHelpers';
import { RootState } from '../../store';
import { Database } from '../../data/database.types';
// Corrected import path for shared queryClient instance
import { queryClient } from '../../components/ReactQueryClientProvider';

// Define specific types for the tables we're watching
type DishRow = Database['public']['Tables']['dishes']['Row'];
type DishComponentRow = Database['public']['Tables']['dish_components']['Row'];

// Action types
const START_DISH_REALTIME = 'realtime/startDish';
const STOP_DISH_REALTIME = 'realtime/stopDish';
const KITCHEN_CHANGED = 'kitchens/setActiveKitchenId';

// Type for Query Keys 
type DishListQueryKey = [string, { kitchen_id: string }];
type DishDetailQueryKey = [string, { dish_id: string }];

// --- Cache Invalidation Handlers --- 

function* handleDishInsert(queryClient: QueryClient, record: any): Generator<StrictEffect, void, any> {
    console.log('[DishesRealtimeSaga] Handling Dish Insert:', record);
    const dish = record as DishRow; // Assert type
    const listQueryKey: DishListQueryKey = ['dishes', { kitchen_id: dish.kitchen_id }];
    console.log('[DishesRealtimeSaga] Invalidating list query:', listQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: listQueryKey });
}

function* handleDishUpdate(queryClient: QueryClient, record: any): Generator<StrictEffect, void, any> {
    console.log('[DishesRealtimeSaga] Handling Dish Update:', record);
    const dish = record as DishRow;
    const listQueryKey: DishListQueryKey = ['dishes', { kitchen_id: dish.kitchen_id }];
    const detailQueryKey: DishDetailQueryKey = ['dishes', { dish_id: dish.dish_id }];
    console.log('[DishesRealtimeSaga] Invalidating list query:', listQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: listQueryKey });
    console.log('[DishesRealtimeSaga] Invalidating detail query:', detailQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: detailQueryKey });
}

function* handleDishDelete(queryClient: QueryClient, oldRecord: any): Generator<StrictEffect, void, any> {
    console.log('[DishesRealtimeSaga] Handling Dish Delete:', oldRecord);
    const dishToDelete = oldRecord as Partial<DishRow> & { dish_id: string };
    const kitchenId = dishToDelete.kitchen_id || (yield select((state: RootState) => state.kitchens.activeKitchenId));
    const detailQueryKey: DishDetailQueryKey = ['dishes', { dish_id: dishToDelete.dish_id }];

    if (kitchenId) {
        const listQueryKey: DishListQueryKey = ['dishes', { kitchen_id: kitchenId }];
        console.log('[DishesRealtimeSaga] Invalidating list query:', listQueryKey);
        yield call([queryClient, queryClient.invalidateQueries], { queryKey: listQueryKey });
    }
    console.log('[DishesRealtimeSaga] Invalidating/Removing detail query:', detailQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: detailQueryKey });
}

function* handleDishComponentChange(queryClient: QueryClient, record: any, eventType: 'INSERT' | 'UPDATE' | 'DELETE'): Generator<StrictEffect, void, any> {
    console.log(`[DishesRealtimeSaga] Handling Dish Component ${eventType}:`, record);
    const component = record as Partial<DishComponentRow> & { dish_id: string };

    if (component.dish_id) {
        const detailQueryKey: DishDetailQueryKey = ['dishes', { dish_id: component.dish_id }];
        console.log(`[DishesRealtimeSaga] Invalidating dish detail query due to component change: ${JSON.stringify(detailQueryKey)}`);
        yield call([queryClient, queryClient.invalidateQueries], { queryKey: detailQueryKey });
    }
}

// --- Main Subscription Worker Saga ---

function* watchDishChangesWorker(): Generator<StrictEffect, void, any> { 
    const kitchenId: string | null = yield select((state: RootState) => state.kitchens.activeKitchenId);

    if (!queryClient || !kitchenId) { 
        console.warn('[DishesRealtimeSaga] Cannot start subscriptions without QueryClient or Kitchen ID.');
        return;
    }

    let dishesUnsubscribe: (() => Promise<string | void>) | null = null;
    let componentsUnsubscribe: (() => Promise<string | void>) | null = null;

    try {
        const dishFilter = `kitchen_id=eq.${kitchenId}`;
        dishesUnsubscribe = yield call(subscribeToTable, supabase, 'dishes', {
            onInsert: (record) => call(handleDishInsert, queryClient, record), 
            onUpdate: (record) => call(handleDishUpdate, queryClient, record),
            onDelete: (record) => call(handleDishDelete, queryClient, record),
            onError: (error) => console.error('[DishesRealtimeSaga] Dishes subscription error:', error),
        }, dishFilter);

        componentsUnsubscribe = yield call(subscribeToTable, supabase, 'dish_components', {
            onInsert: (record) => call(handleDishComponentChange, queryClient, record, 'INSERT'),
            onUpdate: (record) => call(handleDishComponentChange, queryClient, record, 'UPDATE'),
            onDelete: (record) => call(handleDishComponentChange, queryClient, record, 'DELETE'),
            onError: (error) => console.error('[DishesRealtimeSaga] Dish Components subscription error:', error),
        });

        console.log('[DishesRealtimeSaga] Subscriptions started for kitchen:', kitchenId);
        yield take(STOP_DISH_REALTIME); 

    } catch (error) {
        console.error('[DishesRealtimeSaga] Error setting up subscriptions:', error);
    } finally {
        console.log('[DishesRealtimeSaga] Cleaning up subscriptions...');
        if (yield cancelled()) {
            console.log('[DishesRealtimeSaga] Saga cancelled.');
        }
        if (dishesUnsubscribe) yield call(dishesUnsubscribe);
        if (componentsUnsubscribe) yield call(componentsUnsubscribe);
        console.log('[DishesRealtimeSaga] Subscriptions stopped.');
    }
}

// --- Watcher Saga ---

export function* dishesRealtimeSaga(): Generator<StrictEffect, void, any> { 
    let task: any = null;
    while (true) {
        const action: Action = yield take([START_DISH_REALTIME, KITCHEN_CHANGED]);
        console.log('[DishesRealtimeSaga] Action received:', action.type);

        if (task) {
            console.log('[DishesRealtimeSaga] Cancelling previous task...');
            yield cancel(task);
        }

        const kitchenId: string | null = yield select((state: RootState) => state.kitchens.activeKitchenId);
        if (kitchenId) {
            console.log('[DishesRealtimeSaga] Forking new task for kitchen:', kitchenId);
            task = yield fork(watchDishChangesWorker);
        } else {
            console.log('[DishesRealtimeSaga] No active kitchen, stopping realtime.');
            task = null;
        }
    }
}

// Placeholder actions
export const startDishRealtime = (): Action => ({ type: START_DISH_REALTIME });
export const stopDishRealtime = (): Action => ({ type: STOP_DISH_REALTIME }); 