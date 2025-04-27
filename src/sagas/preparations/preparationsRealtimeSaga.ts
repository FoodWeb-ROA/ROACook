import { Action } from '@reduxjs/toolkit';
import { call, fork, select, take, cancel, cancelled, StrictEffect } from 'redux-saga/effects';
import { QueryClient } from '@tanstack/react-query';

import { supabase } from '../../data/supabaseClient';
import { subscribeToTable } from '../../realtime/supabaseChannelHelpers';
import { RootState } from '../../store';
import { Database } from '../../data/database.types';
import { queryClient } from '../../components/ReactQueryClientProvider';

// Define specific types
type PreparationRow = Database['public']['Tables']['preparations']['Row'];
type PreparationIngredientRow = Database['public']['Tables']['preparation_ingredients']['Row'];
// We also need IngredientRow to get kitchen_id for invalidation
type IngredientRow = Database['public']['Tables']['ingredients']['Row']; 

// Action types
const START_PREPARATION_REALTIME = 'realtime/startPreparation';
const STOP_PREPARATION_REALTIME = 'realtime/stopPreparation';
const KITCHEN_CHANGED = 'kitchens/setActiveKitchenId'; // Reuse trigger

// Query Key Types (assuming patterns)
type PreparationListQueryKey = [string, { kitchen_id: string }]; // For usePreparations hook
type PreparationDetailQueryKey = [string, { preparation_id: string }]; // For usePreparationDetail hook
type IngredientListQueryKey = [string, { kitchen_id: string; [key: string]: any }]; // For useIngredients hook

// --- Helper to get kitchen_id for a preparation (needed for list invalidation on DELETE) ---
function* getKitchenIdForPreparation(preparationId: string): Generator<StrictEffect, string | null, any> {
    try {
        // Fetch the corresponding ingredient row to get the kitchen_id
        const { data, error } = yield call(
            () => supabase
                .from('ingredients')
                .select('kitchen_id')
                .eq('ingredient_id', preparationId)
                .single()
        );
        if (error || !data) {
            console.warn(`[PreparationsSaga] Could not fetch kitchen_id for preparation ${preparationId}:`, error);
            return null;
        }
        return data.kitchen_id;
    } catch (e) {
        console.error(`[PreparationsSaga] Error in getKitchenIdForPreparation for ${preparationId}:`, e);
        return null;
    }
}

// --- Cache Invalidation Handlers ---

// Handles Preparation table changes (directions, total_time etc.)
function* handlePreparationUpdate(queryClient: QueryClient, record: any): Generator<StrictEffect, void, any> {
    console.log('[PreparationsSaga] Handling Preparation Update:', record);
    const prep = record as PreparationRow;
    const detailQueryKey: PreparationDetailQueryKey = ['preparations', { preparation_id: prep.preparation_id }];
    // Invalidate detail query
    console.log('[PreparationsSaga] Invalidating detail query:', detailQueryKey);
    yield call([queryClient, queryClient.invalidateQueries], { queryKey: detailQueryKey });
    // Also invalidate the useIngredients hook (with identifyPreparations=true) 
    // as preparation details might affect how it's displayed there.
    const kitchenId: string | null = yield call(getKitchenIdForPreparation, prep.preparation_id);
    if (kitchenId) {
        const ingredientListQueryKeyPattern: Partial<IngredientListQueryKey> = ['ingredients', { kitchen_id: kitchenId }];
        console.log('[PreparationsSaga] Invalidating ingredient list query:', ingredientListQueryKeyPattern);
        yield call([queryClient, queryClient.invalidateQueries], { queryKey: ingredientListQueryKeyPattern });
    }
}

// Handles PreparationIngredient table changes (components of a prep)
function* handlePreparationIngredientChange(queryClient: QueryClient, record: any, eventType: 'INSERT' | 'UPDATE' | 'DELETE'): Generator<StrictEffect, void, any> {
    console.log(`[PreparationsSaga] Handling Preparation Ingredient ${eventType}:`, record);
    const component = record as Partial<PreparationIngredientRow> & { preparation_id: string }; 
    
    if (component.preparation_id) {
        const detailQueryKey: PreparationDetailQueryKey = ['preparations', { preparation_id: component.preparation_id }];
        // Invalidate the parent preparation's detail query
        console.log(`[PreparationsSaga] Invalidating prep detail query due to component change: ${JSON.stringify(detailQueryKey)}`);
        yield call([queryClient, queryClient.invalidateQueries], { queryKey: detailQueryKey });
    }
}

// Note: INSERT/DELETE for Preparations themselves are handled by the ingredientsRealtimeSaga
// because a preparation is fundamentally an ingredient with extra details.

// --- Main Subscription Worker Saga ---

function* watchPreparationChangesWorker(): Generator<StrictEffect, void, any> {
    const kitchenId: string | null = yield select((state: RootState) => state.kitchens.activeKitchenId);

    if (!queryClient || !kitchenId) {
        console.warn('[PreparationsSaga] Cannot start subscriptions without QueryClient or Kitchen ID.');
        return;
    }

    let preparationsUnsubscribe: (() => Promise<string | void>) | null = null;
    let prepIngredientsUnsubscribe: (() => Promise<string | void>) | null = null;

    try {
        // Subscribe to Preparations table changes 
        // We cannot easily filter this by kitchen_id directly, so subscribe to all
        // and rely on handlers checking/fetching kitchen_id if needed for invalidation.
        preparationsUnsubscribe = yield call(subscribeToTable, supabase, 'preparations', {
            // Only handle UPDATE, as INSERT/DELETE are tied to ingredients table
            onUpdate: (record) => call(handlePreparationUpdate, queryClient, record),
            onError: (error) => console.error('[PreparationsSaga] Preparations subscription error:', error),
        });

        // Subscribe to Preparation Ingredients table changes (cannot filter by kitchen_id easily)
        prepIngredientsUnsubscribe = yield call(subscribeToTable, supabase, 'preparation_ingredients', {
            onInsert: (record) => call(handlePreparationIngredientChange, queryClient, record, 'INSERT'),
            onUpdate: (record) => call(handlePreparationIngredientChange, queryClient, record, 'UPDATE'),
            onDelete: (record) => call(handlePreparationIngredientChange, queryClient, record, 'DELETE'),
            onError: (error) => console.error('[PreparationsSaga] Preparation Ingredients subscription error:', error),
        });

        console.log('[PreparationsSaga] Subscriptions started.'); // No kitchen filter applied directly
        yield take(STOP_PREPARATION_REALTIME); // Keep saga running

    } catch (error) {
        console.error('[PreparationsSaga] Error setting up subscriptions:', error);
    } finally {
        console.log('[PreparationsSaga] Cleaning up subscriptions...');
        if (yield cancelled()) {
            console.log('[PreparationsSaga] Saga cancelled.');
        }
        if (preparationsUnsubscribe) yield call(preparationsUnsubscribe);
        if (prepIngredientsUnsubscribe) yield call(prepIngredientsUnsubscribe);
        console.log('[PreparationsSaga] Subscriptions stopped.');
    }
}

// --- Watcher Saga ---

export function* preparationsRealtimeSaga(): Generator<StrictEffect, void, any> {
    let task: any = null;
    while (true) {
        // Wait for start action OR kitchen change (to potentially restart if needed, though not strictly necessary as no kitchen filter is used)
        const action: Action = yield take([START_PREPARATION_REALTIME, KITCHEN_CHANGED]);
        console.log('[PreparationsSaga] Action received:', action.type);

        // Cancel previous task if running
        if (task) {
            console.log('[PreparationsSaga] Cancelling previous task...');
            yield cancel(task);
        }
        
        // Start the worker saga regardless of kitchenId (as filters aren't applied here)
        // The handlers inside might depend on kitchenId for invalidation lookups.
        console.log('[PreparationsSaga] Forking new task...');
        task = yield fork(watchPreparationChangesWorker);
        
    }
}

// Placeholder actions
export const startPreparationRealtime = (): Action => ({ type: START_PREPARATION_REALTIME });
export const stopPreparationRealtime = (): Action => ({ type: STOP_PREPARATION_REALTIME }); 