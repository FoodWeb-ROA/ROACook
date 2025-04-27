import { Action } from '@reduxjs/toolkit';
import { call, fork, select, take, cancel, cancelled, StrictEffect } from 'redux-saga/effects';
import { QueryClient } from '@tanstack/react-query';

import { supabase } from '../../data/supabaseClient';
import { subscribeToTable } from '../../realtime/supabaseChannelHelpers';
import { RootState } from '../../store';
import { Database } from '../../data/database.types';
import { queryClient } from '../../components/ReactQueryClientProvider';

// Define specific types
type IngredientRow = Database['public']['Tables']['ingredients']['Row'];

// Action types
const START_INGREDIENT_REALTIME = 'realtime/startIngredient';
const STOP_INGREDIENT_REALTIME = 'realtime/stopIngredient';
const KITCHEN_CHANGED = 'kitchens/setActiveKitchenId'; // Reuse same trigger

// Query Key Type (assuming list query pattern)
// Using generic object type for filters to accommodate optional identifyPreparations flag
type IngredientListQueryKey = [string, { kitchen_id: string; [key: string]: any }];

// --- Cache Invalidation Handlers ---

function* handleIngredientInsert(queryClient: QueryClient, record: any): Generator<StrictEffect, void, any> {
    console.log('[IngredientsRealtimeSaga] Handling Ingredient Insert:', record);
    const ingredient = record as IngredientRow;
    // Invalidate ingredient list queries for this kitchen (covers both base and with-preps variants)
    const listQueryKeyPattern: Partial<IngredientListQueryKey> = ['ingredients', { kitchen_id: ingredient.kitchen_id }];
    console.log('[IngredientsRealtimeSaga] Invalidating list queries matching pattern:', listQueryKeyPattern);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: listQueryKeyPattern }); 
    // NOTE: Also need to invalidate Preparations list if a new ingredient *is* a preparation.
    // This might be better handled by subscribing to the 'preparations' table itself in a separate saga.
}

function* handleIngredientUpdate(queryClient: QueryClient, record: any): Generator<StrictEffect, void, any> {
    console.log('[IngredientsRealtimeSaga] Handling Ingredient Update:', record);
    const ingredient = record as IngredientRow;
    // Invalidate list queries
    const listQueryKeyPattern: Partial<IngredientListQueryKey> = ['ingredients', { kitchen_id: ingredient.kitchen_id }];
    console.log('[IngredientsRealtimeSaga] Invalidating list queries matching pattern:', listQueryKeyPattern);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: listQueryKeyPattern });
    
    // Also invalidate the specific preparation detail query if this ingredient IS a preparation
    // We need a way to know if it's a prep. Assume for now an update might affect it.
    const prepDetailQueryKey = ['preparations', { preparation_id: ingredient.ingredient_id }];
    console.log('[IngredientsRealtimeSaga] Invalidating preparation detail query:', prepDetailQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: prepDetailQueryKey });

}

function* handleIngredientDelete(queryClient: QueryClient, oldRecord: any): Generator<StrictEffect, void, any> {
    console.log('[IngredientsRealtimeSaga] Handling Ingredient Delete:', oldRecord);
    const ingredientToDelete = oldRecord as Partial<IngredientRow> & { ingredient_id: string };
    const kitchenId = ingredientToDelete.kitchen_id || (yield select((state: RootState) => state.kitchens.activeKitchenId));

    // Invalidate list queries
    if (kitchenId) {
        const listQueryKeyPattern: Partial<IngredientListQueryKey> = ['ingredients', { kitchen_id: kitchenId }];
        console.log('[IngredientsRealtimeSaga] Invalidating list queries matching pattern:', listQueryKeyPattern);
        yield call([queryClient, queryClient.invalidateQueries], { queryKey: listQueryKeyPattern });
    }
    // Invalidate/remove prep detail query if this ingredient was a preparation
    const prepDetailQueryKey = ['preparations', { preparation_id: ingredientToDelete.ingredient_id }];
    console.log('[IngredientsRealtimeSaga] Invalidating preparation detail query:', prepDetailQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: prepDetailQueryKey });
}


// --- Main Subscription Worker Saga ---

function* watchIngredientChangesWorker(): Generator<StrictEffect, void, any> {
    const kitchenId: string | null = yield select((state: RootState) => state.kitchens.activeKitchenId);

    if (!queryClient || !kitchenId) {
        console.warn('[IngredientsRealtimeSaga] Cannot start subscriptions without QueryClient or Kitchen ID.');
        return;
    }

    let ingredientsUnsubscribe: (() => Promise<string | void>) | null = null;

    try {
        // Subscribe to Ingredients for the current kitchen
        const ingredientFilter = `kitchen_id=eq.${kitchenId}`;
        ingredientsUnsubscribe = yield call(subscribeToTable, supabase, 'ingredients', {
            onInsert: (record) => call(handleIngredientInsert, queryClient, record),
            onUpdate: (record) => call(handleIngredientUpdate, queryClient, record),
            onDelete: (record) => call(handleIngredientDelete, queryClient, record),
            onError: (error) => console.error('[IngredientsRealtimeSaga] Ingredients subscription error:', error),
        }, ingredientFilter);

        console.log('[IngredientsRealtimeSaga] Subscriptions started for kitchen:', kitchenId);
        yield take(STOP_INGREDIENT_REALTIME); // Keep saga running

    } catch (error) {
        console.error('[IngredientsRealtimeSaga] Error setting up subscriptions:', error);
    } finally {
        console.log('[IngredientsRealtimeSaga] Cleaning up subscriptions...');
        if (yield cancelled()) {
            console.log('[IngredientsRealtimeSaga] Saga cancelled.');
        }
        if (ingredientsUnsubscribe) yield call(ingredientsUnsubscribe);
        console.log('[IngredientsRealtimeSaga] Subscriptions stopped.');
    }
}

// --- Watcher Saga ---

export function* ingredientsRealtimeSaga(): Generator<StrictEffect, void, any> {
    let task: any = null;
    while (true) {
        const action: Action = yield take([START_INGREDIENT_REALTIME, KITCHEN_CHANGED]);
        console.log('[IngredientsRealtimeSaga] Action received:', action.type);

        if (task) {
            console.log('[IngredientsRealtimeSaga] Cancelling previous task...');
            yield cancel(task);
        }

        const kitchenId: string | null = yield select((state: RootState) => state.kitchens.activeKitchenId);
        if (kitchenId) {
            console.log('[IngredientsRealtimeSaga] Forking new task for kitchen:', kitchenId);
            task = yield fork(watchIngredientChangesWorker);
        } else {
            console.log('[IngredientsRealtimeSaga] No active kitchen, stopping realtime.');
            task = null;
        }
    }
}

// Placeholder actions
export const startIngredientRealtime = (): Action => ({ type: START_INGREDIENT_REALTIME });
export const stopIngredientRealtime = (): Action => ({ type: STOP_INGREDIENT_REALTIME }); 