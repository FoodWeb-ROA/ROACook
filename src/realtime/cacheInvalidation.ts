import { QueryClient } from '@tanstack/react-query';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Database } from '../data/database.types';
import { appLogger } from '../services/AppLogService';

// Define row types needed for specific cache updates
type KitchenRow = Database['public']['Tables']['kitchen']['Row'];
type KitchenUserRow = Database['public']['Tables']['kitchen_users']['Row'];
type DishRow = Database['public']['Tables']['dishes']['Row'];
type IngredientRow = Database['public']['Tables']['ingredients']['Row'];
type PreparationRow = Database['public']['Tables']['preparations']['Row'];
type PreparationIngredientRow = Database['public']['Tables']['preparation_ingredients']['Row'];
type MenuSectionRow = Database['public']['Tables']['menu_section']['Row'];
type DishComponentRow = Database['public']['Tables']['dish_components']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

// Define generic payload type for clarity
type SupabasePayload = RealtimePostgresChangesPayload<{[key: string]: any}>;

// Helper type for list query data
type ListQueryData<T> = T[] | undefined;

/**
 * Applies incoming Supabase Realtime events to the React Query cache.
 * Prefers surgical updates (`setQueryData`) over broad invalidation where practical.
 *
 * @param payload - The Supabase Realtime payload.
 * @param queryClient - The TanStack Query client instance.
 * @param currentUserId - The ID of the currently logged-in user (optional, for filtering).
 * @param currentKitchenId - The ID of the currently active kitchen (optional, for filtering).
 */
export function applyRealtimeEvent(
    payload: SupabasePayload,
    queryClient: QueryClient,
    currentUserId?: string | null,
    currentKitchenId?: string | null
) {
    const { eventType, table, new: newRecord, old: oldRecord, schema } = payload;

    // Only process events for the public schema
    if (schema !== 'public') {
        appLogger.log(`[CacheInvalidation] Ignoring event for non-public schema: ${schema}`);
        return;
    }

    appLogger.log(`[CacheInvalidation] Applying ${eventType} on public.${table}:`, payload);

    // Helper to invalidate queries with a specific prefix
    const invalidate = (queryKeyPrefix: unknown[]) => {
        appLogger.log(`[CacheInvalidation] Invalidating query key prefix:`, queryKeyPrefix);
        queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
    };

    // Helper to update list cache data
    const updateListCache = <T extends { [key: string]: any }>(
        queryKey: unknown[],
        newItem: T | null,
        oldItemId: any | null,
        idField: keyof T
    ) => {
        queryClient.setQueryData<ListQueryData<T>>(queryKey, (oldData) => {
            if (!oldData) return undefined; // No existing cache, do nothing (or maybe return [newItem] for INSERT?)

            switch (eventType) {
                case 'INSERT':
                    appLogger.log(`[CacheInvalidation][${String(idField)}] Surgically inserting into list cache:`, queryKey);
                    // Add only if it doesn't exist (prevent duplicates from potential race conditions)
                    if (!newItem || oldData.some(item => item[idField] === newItem[idField])) {
                        return oldData;
                    }
                    return [...oldData, newItem];
                case 'UPDATE':
                     appLogger.log(`[CacheInvalidation][${String(idField)}] Surgically updating list cache:`, queryKey);
                    if (!newItem) return oldData;
                    return oldData.map(item => item[idField] === newItem[idField] ? newItem : item);
                case 'DELETE':
                     appLogger.log(`[CacheInvalidation][${String(idField)}] Surgically deleting from list cache:`, queryKey);
                    if (!oldItemId) return oldData;
                    return oldData.filter(item => item[idField] !== oldItemId);
                default:
                    return oldData;
            }
        });
    };

     // Helper to get the relevant kitchen ID, prioritizing record data over current context
     const getRelevantKitchenId = (newRec: any, oldRec: any): string | null | undefined => {
        return newRec?.kitchen_id ?? oldRec?.kitchen_id ?? currentKitchenId;
     };


    switch (table) {
        case 'kitchen': {
            // Invalidation Only
            const kitchenNew = newRecord as Partial<KitchenRow>;
            const kitchenOld = oldRecord as Partial<KitchenRow>;
            if (currentUserId) {
                invalidate(['kitchen_users', `user_id=eq.${currentUserId}`]);
                const kid = kitchenNew?.kitchen_id ?? kitchenOld?.kitchen_id;
                if (kid) invalidate(['kitchen', { kitchen_id: kid }]);
            }
            break;
        }

        case 'kitchen_users': {
            // Invalidation Only
            const kuNew = newRecord as Partial<KitchenUserRow>;
            const kuOld = oldRecord as Partial<KitchenUserRow>;
            if (currentUserId) {
                invalidate(['kitchen_users', `user_id=eq.${currentUserId}`]);
            }
            if ((kuNew?.user_id === currentUserId || kuOld?.user_id === currentUserId) && currentKitchenId) {
                 // User added/removed from *a* kitchen, invalidate current kitchen lists just in case
                invalidate(['dishes', { kitchen_id: currentKitchenId }]);
                invalidate(['ingredients', { kitchen_id: currentKitchenId }]);
                invalidate(['preparations', { kitchen_id: currentKitchenId }]);
                invalidate(['menu_section', { kitchen_id: currentKitchenId }]);
            }
            break;
        }

        case 'dishes': {
            const dishNew = newRecord as DishRow | Partial<DishRow>; // Use full type if possible
            const dishOld = oldRecord as Partial<DishRow>;
            const dishId = dishNew?.dish_id ?? dishOld?.dish_id;
            const kitchenIdForDish = getRelevantKitchenId(dishNew, dishOld);

            if (!dishId || !kitchenIdForDish) {
                 appLogger.warn('[CacheInvalidation][dishes] Missing dish_id or kitchen_id, falling back to broad invalidation.');
                 if(currentKitchenId) invalidate(['dishes', { kitchen_id: currentKitchenId }]);
                 invalidate(['menu_section']); // Invalidate all menu sections if kitchen unknown
                 return;
            }

            const listQueryKey = ['dishes', { kitchen_id: kitchenIdForDish }];
            const detailQueryKey = ['dishes', { dish_id: dishId }];

            // Surgical update for list
            updateListCache<DishRow>(
                listQueryKey,
                eventType === 'DELETE' ? null : (dishNew as DishRow), // Pass null for DELETE newItem
                eventType === 'DELETE' ? dishId : null, // Pass old ID for DELETE
                'dish_id'
            );

             // Surgical/Invalidation update for detail view
            switch (eventType) {
                case 'INSERT':
                case 'UPDATE':
                     appLogger.log('[CacheInvalidation][dishes] Surgically updating detail cache:', detailQueryKey);
                     queryClient.setQueryData(detailQueryKey, dishNew);
                     break;
                case 'DELETE':
                     appLogger.log('[CacheInvalidation][dishes] Removing detail cache:', detailQueryKey);
                     queryClient.removeQueries({ queryKey: detailQueryKey });
                     break;
            }

            // Invalidate related menu sections (as dish assignment might change)
             invalidate(['menu_section', { kitchen_id: kitchenIdForDish }]);
            break;
        }

        case 'ingredients': {
            const ingNew = newRecord as IngredientRow | Partial<IngredientRow>;
            const ingOld = oldRecord as Partial<IngredientRow>;
            const ingredientId = ingNew?.ingredient_id ?? ingOld?.ingredient_id;
             // Preparations ARE ingredients, so use ingredient_id as the key
            const preparationId = ingredientId; // Alias for clarity
            const kitchenIdForIngredient = getRelevantKitchenId(ingNew, ingOld);

            if (!ingredientId || !kitchenIdForIngredient) {
                 appLogger.warn('[CacheInvalidation][ingredients] Missing ingredient_id or kitchen_id, falling back to broad invalidation.');
                  if(currentKitchenId) {
                    invalidate(['ingredients', { kitchen_id: currentKitchenId }]);
                    invalidate(['preparations', { kitchen_id: currentKitchenId }]); // Invalidate both lists
                    invalidate(['dishes', { kitchen_id: currentKitchenId }]);
                  }
                 return;
            }

            const listQueryKey = ['ingredients', { kitchen_id: kitchenIdForIngredient }];
            const prepListQueryKey = ['preparations', { kitchen_id: kitchenIdForIngredient }];
            const detailQueryKey = ['ingredients', { ingredient_id: ingredientId }];
            // Preparations also use ingredient_id as their primary key in the 'preparations' detail query structure
            const prepDetailQueryKey = ['preparations', { preparation_id: preparationId }];

             // --- Surgical update for ingredient list ---
             updateListCache<IngredientRow>(
                listQueryKey,
                eventType === 'DELETE' ? null : (ingNew as IngredientRow),
                eventType === 'DELETE' ? ingredientId : null,
                'ingredient_id'
             );

             // --- Surgical update for preparation list (if applicable) ---
             // Only update prep list if this ingredient IS a preparation (check payload or assume based on context if needed)
             // We might need more info here, or rely on the prep table event.
             // For simplicity, we can *invalidate* the prep list instead of complex checks.
             invalidate(prepListQueryKey);


             // --- Surgical/Invalidation update for detail views ---
             if (eventType === 'DELETE') {
                 appLogger.log('[CacheInvalidation][ingredients] Removing detail cache:', detailQueryKey);
                 queryClient.removeQueries({ queryKey: detailQueryKey });
                 // Also remove the corresponding prep detail cache if it existed
                  appLogger.log('[CacheInvalidation][ingredients] Removing potentially linked prep detail cache:', prepDetailQueryKey);
                 queryClient.removeQueries({ queryKey: prepDetailQueryKey });
             } else {
                 appLogger.log('[CacheInvalidation][ingredients] Surgically updating detail cache:', detailQueryKey);
                 queryClient.setQueryData(detailQueryKey, ingNew);
                 // We don't have enough info here to update the *preparation* detail view surgically from an *ingredient* event.
                 // Invalidate the preparation detail instead.
                 appLogger.log('[CacheInvalidation][ingredients] Invalidating potentially linked prep detail cache:', prepDetailQueryKey);
                 invalidate(prepDetailQueryKey);
             }

            // Invalidate dishes and preparations in the kitchen (as they might use this ingredient/prep)
            invalidate(['dishes', { kitchen_id: kitchenIdForIngredient }]);
            // Prep list invalidation already handled above
            break;
        }

        case 'preparations': {
            const prepNew = newRecord as PreparationRow | Partial<PreparationRow>;
            const prepOld = oldRecord as Partial<PreparationRow>;
            const preparationId = prepNew?.preparation_id ?? prepOld?.preparation_id;
            // kitchen_id is not directly on preparations table, must rely on context or linked ingredient
            const kitchenIdForPrep = currentKitchenId; // Use active kitchen context

            if (!preparationId || !kitchenIdForPrep) {
                 appLogger.warn('[CacheInvalidation][preparations] Missing preparation_id or kitchen context, falling back to broad invalidation.');
                 if(currentKitchenId) {
                     invalidate(['preparations', { kitchen_id: currentKitchenId }]);
                     invalidate(['ingredients', { kitchen_id: currentKitchenId }]); // Invalidate both lists
                     invalidate(['dishes', { kitchen_id: currentKitchenId }]);
                 }
                 return;
            }

             const listQueryKey = ['preparations', { kitchen_id: kitchenIdForPrep }];
             // Preparations also exist in the ingredients list/detail views
             const ingredientListQueryKey = ['ingredients', { kitchen_id: kitchenIdForPrep }];
             const ingredientDetailQueryKey = ['ingredients', { ingredient_id: preparationId }]; // Prep ID is Ingredient ID
             const detailQueryKey = ['preparations', { preparation_id: preparationId }];

             // --- Surgical update for preparation list ---
             updateListCache<PreparationRow>( // Assuming PreparationRow fits the structure needed for the prep list
                 listQueryKey,
                 eventType === 'DELETE' ? null : (prepNew as PreparationRow), // May need transformation
                 eventType === 'DELETE' ? preparationId : null,
                 'preparation_id'
             );

            // --- Invalidate (or surgically update if structure matches) the ingredients list ---
            // Since a preparation *is* an ingredient, removing/updating it affects the ingredient list.
            // Surgical update is complex as the PreparationRow might differ from IngredientRow. Invalidate is safer.
             appLogger.log('[CacheInvalidation][preparations] Invalidating ingredients list due to prep change:', ingredientListQueryKey);
            invalidate(ingredientListQueryKey);

            // --- Surgical/Invalidation update for detail views ---
             if (eventType === 'DELETE') {
                 appLogger.log('[CacheInvalidation][preparations] Removing detail cache:', detailQueryKey);
                 queryClient.removeQueries({ queryKey: detailQueryKey });
                 // Also remove the corresponding ingredient detail cache
                  appLogger.log('[CacheInvalidation][preparations] Removing linked ingredient detail cache:', ingredientDetailQueryKey);
                 queryClient.removeQueries({ queryKey: ingredientDetailQueryKey });
             } else {
                 appLogger.log('[CacheInvalidation][preparations] Surgically updating detail cache:', detailQueryKey);
                 queryClient.setQueryData(detailQueryKey, prepNew); // Assuming structure matches cache
                  // Invalidate the corresponding ingredient detail cache as structure likely differs
                 appLogger.log('[CacheInvalidation][preparations] Invalidating linked ingredient detail cache:', ingredientDetailQueryKey);
                 invalidate(ingredientDetailQueryKey);
             }

            // Invalidate dishes in the kitchen (as they might use this prep)
            invalidate(['dishes', { kitchen_id: kitchenIdForPrep }]);
            // ALSO invalidate active dish detail queries, as their embedded prep might have changed
            appLogger.log('[CacheInvalidation][preparations] Invalidating dish list and detail queries.');
            invalidate(['dishes']); // More specific: Invalidate all queries starting with 'dishes' (list and details)
            break;
        }

        case 'preparation_ingredients': {
            // Invalidation Only (affects preparation detail)
            const prepIngNew = newRecord as Partial<PreparationIngredientRow>;
            const prepIngOld = oldRecord as Partial<PreparationIngredientRow>;
            const parentPrepId = prepIngNew?.preparation_id ?? prepIngOld?.preparation_id;
            const kitchenIdForPrepIng = currentKitchenId; // Simplified assumption

            if (parentPrepId) {
                appLogger.log(`[CacheInvalidation][preparation_ingredients] Invalidating parent prep detail:`, ['preparations', { preparation_id: parentPrepId }]);
                invalidate(['preparations', { preparation_id: parentPrepId }]);
            } else {
                 appLogger.warn('[CacheInvalidation][preparation_ingredients] Missing parent preparation_id, cannot invalidate specific detail.');
            }
            // Invalidate potentially affected lists and details
            if (kitchenIdForPrepIng) {
                invalidate(['dishes', { kitchen_id: kitchenIdForPrepIng }]); // Invalidate dish list
                invalidate(['ingredients', { kitchen_id: kitchenIdForPrepIng }]); // Amounts might change derived values
                 invalidate(['preparations', { kitchen_id: kitchenIdForPrepIng }]);
            }
            // ALSO invalidate active dish detail queries, as their embedded prep might have changed
            appLogger.log('[CacheInvalidation][preparation_ingredients] Invalidating dish list and detail queries.');
            invalidate(['dishes']); // More specific: Invalidate all queries starting with 'dishes' (list and details)
            break;
        }

        case 'menu_section': {
            const menuNew = newRecord as MenuSectionRow | Partial<MenuSectionRow>;
            const menuOld = oldRecord as Partial<MenuSectionRow>;
            const menuSectionId = menuNew?.menu_section_id ?? menuOld?.menu_section_id;
            const kitchenIdForMenu = getRelevantKitchenId(menuNew, menuOld);

             if (!menuSectionId || !kitchenIdForMenu) {
                 appLogger.warn('[CacheInvalidation][menu_section] Missing menu_section_id or kitchen_id, falling back to broad invalidation.');
                 if(currentKitchenId) invalidate(['menu_section', { kitchen_id: currentKitchenId }]);
                 return;
             }

             const listQueryKey = ['menu_section', { kitchen_id: kitchenIdForMenu }];
             const detailQueryKey = ['menu_section', { menu_section_id: menuSectionId }]; // If detail view exists

             // Surgical update for list
             updateListCache<MenuSectionRow>(
                 listQueryKey,
                 eventType === 'DELETE' ? null : (menuNew as MenuSectionRow),
                 eventType === 'DELETE' ? menuSectionId : null,
                 'menu_section_id'
             );

             // Surgical/Invalidation update for detail view (if applicable)
            switch (eventType) {
                case 'INSERT':
                case 'UPDATE':
                     appLogger.log('[CacheInvalidation][menu_section] Surgically updating detail cache:', detailQueryKey);
                     queryClient.setQueryData(detailQueryKey, menuNew);
                     break;
                case 'DELETE':
                     appLogger.log('[CacheInvalidation][menu_section] Removing detail cache:', detailQueryKey);
                     queryClient.removeQueries({ queryKey: detailQueryKey });
                     break;
            }

            // Invalidate related dishes (as assignment might change)
             invalidate(['dishes', { kitchen_id: kitchenIdForMenu }]);
            break;
        }

        case 'dish_components': {
            // Invalidation Only (affects dish detail)
            const dcNew = newRecord as Partial<DishComponentRow>;
            const dcOld = oldRecord as Partial<DishComponentRow>;
            const parentDishId = dcNew?.dish_id ?? dcOld?.dish_id;
            const kitchenIdForDishComp = currentKitchenId; // Simplified assumption

            if (parentDishId) {
                appLogger.log(`[CacheInvalidation][dish_components] Invalidating parent dish detail:`, ['dishes', { dish_id: parentDishId }]);
                invalidate(['dishes', { dish_id: parentDishId }]);
            } else {
                 appLogger.warn('[CacheInvalidation][dish_components] Missing parent dish_id, cannot invalidate specific detail.');
            }
            // Invalidate potentially affected lists
             if (kitchenIdForDishComp) {
                invalidate(['ingredients', { kitchen_id: kitchenIdForDishComp }]);
                invalidate(['preparations', { kitchen_id: kitchenIdForDishComp }]);
             }
            break;
        }

         case 'units': {
             const unitNew = newRecord as UnitRow | Partial<UnitRow>;
             const unitOld = oldRecord as Partial<UnitRow>;
             const unitId = unitNew?.unit_id ?? unitOld?.unit_id;

             if (!unitId) {
                 appLogger.warn('[CacheInvalidation][units] Missing unit_id, falling back to broad invalidation.');
                 invalidate(['units']); // Invalidate all units
                 return;
             }

             const listQueryKey = ['units']; // Units are likely global, not kitchen-specific
             const detailQueryKey = ['units', { unit_id: unitId }]; // If detail view exists

             // Surgical update for list
             updateListCache<UnitRow>(
                 listQueryKey,
                 eventType === 'DELETE' ? null : (unitNew as UnitRow),
                 eventType === 'DELETE' ? unitId : null,
                 'unit_id'
             );

             // Surgical/Invalidation update for detail view (if applicable)
             switch (eventType) {
                 case 'INSERT':
                 case 'UPDATE':
                     appLogger.log('[CacheInvalidation][units] Surgically updating detail cache:', detailQueryKey);
                     queryClient.setQueryData(detailQueryKey, unitNew);
                     break;
                 case 'DELETE':
                     appLogger.log('[CacheInvalidation][units] Removing detail cache:', detailQueryKey);
                     queryClient.removeQueries({ queryKey: detailQueryKey });
                     break;
             }
             // Units changing might affect display everywhere, broad invalidation might be needed
             // Invalidate dishes, ingredients, preps etc. if unit display depends on this data
             appLogger.warn('[CacheInvalidation][units] Unit changed, consider invalidating dependent tables (dishes, ingredients, preps).');
              if (currentKitchenId) {
                  invalidate(['dishes', { kitchen_id: currentKitchenId }]);
                  invalidate(['ingredients', { kitchen_id: currentKitchenId }]);
                  invalidate(['preparations', { kitchen_id: currentKitchenId }]);
              }
             break;
        }


        default:
            appLogger.warn(`[CacheInvalidation] No specific invalidation/update logic for table: ${table}`);
            // Optional: Generic invalidation based on table name as a fallback?
            // invalidate([table]);
            break;
    }
}
