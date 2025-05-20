/**
 * Supabase Integration Hooks
 * 
 * UPDATED: Now uses the kitchen_users linking table to retrieve kitchen_id from auth.users
 * 
 * The hooks in this file provide access to the Supabase backend data.
 * All hooks that fetch kitchen-specific data now use the useCurrentKitchenId hook,
 * which retrieves the kitchen_id from the kitchen_users table based on the 
 * authenticated user's ID from auth.users.
 * 
 * This change reflects the database migration that now links auth.users directly
 * to public.kitchen_users, removing the intermediate public.users table.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../data/supabaseClient';
import { Dish, DishComponent, Ingredient, Unit, MenuSection, Preparation, PreparationIngredient } from '../types';
import { 
  transformDish, 
  transformDishComponent, 
  transformPreparation, 
  transformMenuSection, 
  transformPreparationIngredient, 
  transformUnit, 
  transformIngredient, 
  FetchedDishData, 
  DbMenuSection, 
  FetchedBaseComponent, 
  FetchedIngredientDetail, 
  FetchedPreparationDetail, 
  FetchedPreparationIngredient, 
  AssembledComponentData, 
  DbDishComponent, 
  DbUnit, 
  FetchedPreparationDataCombined 
} from '../utils/transforms';
import { useAuth } from '../context/AuthContext'; // Import useAuth
// ADDED: Import offline caching helpers
import { getOfflineRecipe, saveOfflineRecipe, OfflineDishPayload, OfflinePreparationPayload } from '../persistence/offlineRecipes';
// ADDED: Import useQuery and QueryClient
import { useQuery, useQueryClient } from '@tanstack/react-query'; 
import { queryClient } from '../data/queryClient'; // Corrected import path
import { useTypedSelector } from './useTypedSelector'; // Import useTypedSelector
import { fetchPreparationDetailsFromDB } from '../data/dbLookup';
import { appLogger } from '../services/AppLogService';

/**
 * Custom hook to get the current active kitchen ID for the authenticated user.
 * Reads the activeKitchenId directly from the Redux store.
 */
export function useCurrentKitchenId(): string | null {
  // Read activeKitchenId directly from Redux state
  const activeKitchenId = useTypedSelector(state => state.kitchens.activeKitchenId);
  
  // Return the value from Redux
  return activeKitchenId;
}

/**
 * Hook to fetch all dishes for the current kitchen, with optional filter by menu section.
 * REFACTORED: Uses TanStack Query (useQuery) for caching and automatic updates.
 * ADDED: Realtime subscription to invalidate cache on changes.
 * ADDED: Returns lastUpdateTime to signal Realtime updates.
 */
export function useDishes(menuSectionId?: string) {
  const kitchenId = useCurrentKitchenId();
  const queryClient = useQueryClient();
  const queryKey = ['dishes', { kitchen_id: kitchenId, menu_section_id: menuSectionId }];
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null); // ADDED

  // Define the asynchronous fetch function
  const fetchDishes = async () => {
      if (!kitchenId) {
      // Throw an error or return empty array if kitchenId is not available
      // useQuery's `enabled` option handles this better
      // throw new Error("Kitchen ID not available. Cannot fetch dishes.");
      return []; // Return empty array if kitchenId is null/undefined
    }

    // Moved the existing fetch logic here
        let query = supabase
          .from('dishes')
          .select(`
            dish_id,
            dish_name,
            total_time,
            serving_size,
            cooking_notes,
            serving_item,
            num_servings,
            directions,
            menu_section:recipe_menu_section_id_fkey (*),
            serving_unit:units!dishes_serving_unit_fkey (*)
          `)
      .eq('kitchen_id', kitchenId);

        if (menuSectionId) {
          query = query.eq('menu_section_id', menuSectionId);
        }

        const { data: dishesData, error: dishesError } = await query.order('dish_name') as { data: FetchedDishData[] | null, error: any };

        if (dishesError) throw dishesError;
    if (!dishesData) return []; // Return empty array if no data

    // Fetch and include components (this part remains largely the same)
        const dishesWithComponents = await Promise.all(dishesData.map(async (dish) => {
          const { data: dishComponents, error: componentsError } = await supabase
            .from('dish_components')
            .select(`
              *,
              unit:fk_components_unit(*),
              ingredient:fk_components_ing (
                *,
                base_unit:ingredients_unit_id_fkey ( * ),
            preparation:preparations!preparation_id (*)
              )
            `)
            .eq('dish_id', dish.dish_id) as { data: (DbDishComponent & { unit: DbUnit | null, ingredient: (FetchedIngredientDetail & { preparation: FetchedPreparationDetail | null }) | null })[] | null, error: any };

          if (componentsError) {
            appLogger.error(`Error fetching components for dish ${dish.dish_id}:`, componentsError);
            return { ...transformDish(dish as FetchedDishData), components: [] };
          }

          const typedComponents = dishComponents;
          const transformedComponents = typedComponents ? typedComponents.map(comp => {
            const ingredientData = comp.ingredient as (FetchedIngredientDetail & { preparation: FetchedPreparationDetail | null }) | null;
            const assembledData: AssembledComponentData = {
                dish_id: dish.dish_id,
                baseComponent: {
                    ingredient_id: comp.ingredient_id,
                    unit_id: comp.unit_id,
                    amount: comp.amount,
                    piece_type: comp.piece_type
                } as FetchedBaseComponent,
                ingredient: ingredientData ?? undefined,
                preparation: ingredientData?.preparation ?? undefined,
                componentUnit: comp.unit ?? undefined,
            prepIngredients: undefined
            };
            return transformDishComponent(assembledData);
          }) : [];

          return { ...transformDish(dish as FetchedDishData), components: transformedComponents };
        }));

    return dishesWithComponents || [];
  };

  // Use the useQuery hook from TanStack Query
  const { 
    data: dishes, 
    isLoading: loading, // Renamed from isLoading
    error, 
    // refetch // Can be returned if manual refetch is needed
  } = useQuery({
    queryKey: queryKey,
    queryFn: fetchDishes,
    enabled: !!kitchenId, // Only run the query if kitchenId is available
    // staleTime: 5 * 60 * 1000, // Optional: 5 minutes stale time
    // gcTime: 30 * 60 * 1000, // Optional: 30 minutes garbage collection time
  });

  // --- ADDED REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!kitchenId) return; // Don't subscribe if no kitchenId

    const channel = supabase
      .channel('public:dishes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'dishes',
          // Filter server-side for efficiency, though invalidateQueries handles it too
          // filter: `kitchen_id=eq.${kitchenId}` // Uncomment if needed, check performance
        },
        (payload) => {
          appLogger.log('[useDishes] Realtime change received!', payload);
          const affectedKitchen = (payload.new as any)?.kitchen_id || (payload.old as any)?.kitchen_id;
          // Only invalidate if the change affects the current kitchen
          if (affectedKitchen === kitchenId) {
             queryClient.invalidateQueries({ queryKey: ['dishes', { kitchen_id: kitchenId }] });
             setLastUpdateTime(Date.now()); // ADDED: Signal update

             // Handle related invalidations (details, components)
             if (payload.eventType === 'DELETE') {
                 const oldRecord = payload.old as { dish_id?: string };
                 const oldDishId = oldRecord?.dish_id;
                 if (oldDishId) {
                      queryClient.invalidateQueries({ queryKey: ['dish_components', { dish_id: oldDishId }] });
                      queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: oldDishId }] });
                 }
             }
             if (payload.eventType === 'UPDATE') {
                 const newRecord = payload.new as { dish_id?: string };
                 const updatedDishId = newRecord?.dish_id;
                 if (updatedDishId) {
                     queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: updatedDishId }] });
                 }
             }
           }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          appLogger.log('[useDishes] Realtime channel subscribed');
        }
        if (status === 'CHANNEL_ERROR') {
          appLogger.error('[useDishes] Realtime channel error:', err);
        }
        if (status === 'TIMED_OUT') {
          appLogger.warn('[useDishes] Realtime subscription timed out');
        }
      });

    // Cleanup function to remove the channel subscription when the hook unmounts
    return () => {
      supabase.removeChannel(channel);
      appLogger.log('[useDishes] Realtime channel unsubscribed');
    };
  }, [kitchenId, queryClient]); // Re-run effect if kitchenId or queryClient changes
  // --- END REALTIME SUBSCRIPTION ---

  // Return the data, loading state, and error in a compatible format
  // Ensure dishes is always an array, even if data is undefined initially
  return { dishes: dishes ?? [], loading, error, lastUpdateTime }; 
}

/**
 * Hook to fetch a single dish for the current kitchen.
 * ADDED: Realtime subscription to invalidate cache on changes.
 * ADDED: Returns lastUpdateTime to signal Realtime updates.
 */
export type DishWithDetails = Dish & {
    serving_unit?: Unit | null;
    components: DishComponent[];
};

export function useDishDetail(dishId: string | undefined, kitchenId: string | null) {
  // Get query client instance
  const queryClient = useQueryClient();
  // Use React Query to fetch dish details
  const queryKey = ['dish', { dish_id: dishId }];
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null); // ADDED state for update time
  
  // Define the fetch function to be used if the cache doesn't have the data
  const fetchDishDetail = async () => {
    // Handle undefined dishId
    if (!dishId) {
      return null;
    }

    try {
      // First attempt to get dish base data
      const { data: dishData, error: dishError } = await supabase
        .from('dishes')
        .select(`
          dish_id,
          dish_name,
          total_time,
          serving_size,
          cooking_notes,
          serving_item,
          num_servings,
          directions,
          menu_section:recipe_menu_section_id_fkey (*),
          serving_unit:units!dishes_serving_unit_fkey (*)
        `)
        .eq('dish_id', dishId)
        .single() as { data: FetchedDishData | null, error: any };

      if (dishError) throw dishError;
      if (!dishData) return null;

      // Then get the components (ingredients/preparations)
      const { data: dishComponents, error: componentsError } = await supabase
        .from('dish_components')
        .select(`
          *,
          unit:fk_components_unit(*),
          ingredient:fk_components_ing (
            *,
            base_unit:ingredients_unit_id_fkey ( * ),
            preparation:preparations!preparation_id (
              *,
              yield_unit:units!preparations_amount_unit_id_fkey (*),
              ingredients:preparation_ingredients!fk_prep_ingredients_prep (
                *,
                unit:units!fk_prep_ingredients_unit (*),
                ingredient:ingredients!fk_prep_ingredients_ing (name, ingredient_id)
              )
            )
          )
        `)
        .eq('dish_id', dishId) as { 
          data: (DbDishComponent & { 
            unit: DbUnit | null, 
            // Update the type for the ingredient/preparation data to include nested details
            ingredient: (FetchedIngredientDetail & { 
              preparation: (FetchedPreparationDetail & { 
                yield_unit: DbUnit | null, 
                ingredients: (FetchedPreparationIngredient & {
                  unit: DbUnit | null,
                  ingredient: { name: string, ingredient_id: string } | null
                })[] | null
              }) | null 
            }) | null 
          })[] | null, 
          error: any 
        };

      if (componentsError) throw componentsError;

      // --- ADD LOGGING: Raw fetched components ---
      appLogger.log('[useDishDetail] Raw fetched dishComponents:', JSON.stringify(dishComponents, null, 2));
      // --- END LOGGING ---

      // Transform dish and components
      const typedComponents = dishComponents;
      const transformedComponents = typedComponents ? typedComponents.map(comp => {
         // Cast ingredientData to include the new nested structure
         const ingredientData = comp.ingredient as (FetchedIngredientDetail & { 
           preparation: (FetchedPreparationDetail & { 
             yield_unit: DbUnit | null, 
             ingredients: (FetchedPreparationIngredient & {
               unit: DbUnit | null,
               ingredient: { name: string, ingredient_id: string } | null
             })[] | null
           }) | null 
         }) | null;
         
         // Transform nested preparation ingredients if they exist
         const transformedPrepIngredients = ingredientData?.preparation?.ingredients?.map(ing => {
             const ingName = ing.ingredient?.name || 'Unknown Ingredient';
             const ingId = ing.ingredient?.ingredient_id || '';
             return {
                 preparation_id: ing.preparation_id || '',
                 ingredient_id: ingId,
                 name: ingName,
                 amount: ing.amount ?? 0,
                 unit: transformUnit(ing.unit)
             };
         }) || [];

        const assembledData: AssembledComponentData = {
          dish_id: dishId,
          baseComponent: {
            ingredient_id: comp.ingredient_id,
            unit_id: comp.unit_id,
            amount: comp.amount,
            piece_type: comp.piece_type
          } as FetchedBaseComponent,
          ingredient: ingredientData ?? undefined,
          // Pass the FULL base preparation data, including nested ingredients
          preparation: ingredientData?.preparation ?? undefined, 
          componentUnit: comp.unit ?? undefined,
          // Pass the transformed prep ingredients separately
          prepIngredients: transformedPrepIngredients 
        };
        // --- ADD LOGGING: Data before transformDishComponent ---
        appLogger.log(`[useDishDetail] Assembled data for comp ${comp.ingredient_id}:`, JSON.stringify(assembledData, null, 2));
        // --- END LOGGING ---
        return transformDishComponent(assembledData);
      }) : [];

      // Combine dish data with components
      const dishWithDetails: DishWithDetails = {
        ...transformDish(dishData as FetchedDishData),
        components: transformedComponents
      };

      // Construct the payload for offline caching, ensuring all fields are present
      const payloadToCache: OfflineDishPayload = {
          schemaVersion: 1, // Add required field
          fetchedAt: Date.now(), // Add required field
          dish_id: dishWithDetails.dish_id,
          dish_name: dishWithDetails.dish_name,
          directions: dishWithDetails.directions,
          total_time: dishWithDetails.total_time,
          serving_size: dishWithDetails.serving_size,
          serving_unit_id: dishWithDetails.serving_unit?.unit_id ?? null, // Add required field
          serving_unit: dishWithDetails.serving_unit ?? null,
          num_servings: dishWithDetails.num_servings ?? 1, // Ensure num_servings is provided
          cooking_notes: dishWithDetails.cooking_notes,
          serving_item: dishWithDetails.serving_item ?? null, // Ensure serving_item is provided
          components: dishWithDetails.components,
      };

      // Also save to offline cache for future use
      try {
        await saveOfflineRecipe(dishId, 'dish', payloadToCache); // Pass the correct payload
      } catch (cacheError) {
        appLogger.warn(`[useDishDetail] Failed to cache dish ${dishId}:`, cacheError);
        // Non-fatal, continue without caching
      }

      return dishWithDetails;
    } catch (error) {
      appLogger.error(`[useDishDetail] Error fetching dish ${dishId}:`, error);
      throw error;
    }
  };

  // Use useQuery hook for caching and automatic background updates
  const {
    data: dish,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey,
    queryFn: fetchDishDetail,
    enabled: !!dishId, // Only fetch if dishId is provided
    // Leverage the prefetched data or data from cache first
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // --- UPDATED REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!dishId || !dish) return; // Exit if no dishId or initial dish data not yet loaded

    // --- Base listeners for dish and dish_components ---
    const dishChannel = supabase
      .channel(`public:dishes:dish_id=eq.${dishId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dishes', filter: `dish_id=eq.${dishId}` },
        (payload) => {
          appLogger.log(`[useDishDetail] Realtime change for dish ${dishId} received!`, payload);
          queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: dishId }] });
          setLastUpdateTime(Date.now());
        }
      )
      .subscribe(statusCallback('Dish'));

    const componentsChannel = supabase
      .channel(`public:dish_components:dish_id=eq.${dishId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dish_components', filter: `dish_id=eq.${dishId}` },
        (payload) => {
          appLogger.log(`[useDishDetail] Realtime change for dish_components of ${dishId} received!`, payload);
          queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: dishId }] });
          queryClient.invalidateQueries({ queryKey: ['dishes', { kitchen_id: kitchenId }] });
          
          setLastUpdateTime(Date.now());
        }
      )
      .subscribe(statusCallback('DishComponents'));
      
    // --- Dynamic listeners for nested preparations --- 
    const prepIds = dish.components
      .filter(c => c.isPreparation && c.preparationDetails?.preparation_id)
      .map(c => c.preparationDetails!.preparation_id);
      
    const uniquePrepIds = Array.from(new Set(prepIds));
    const prepListeners: any[] = []; // Store channel subscriptions for cleanup
    
    appLogger.log(`[useDishDetail] Setting up listeners for nested preps: ${uniquePrepIds.join(', ')}`);
    
    uniquePrepIds.forEach(prepId => {
      // 1. Listen to the preparation itself
      const prepDetailChannel = supabase
        .channel(`dish-${dishId}-prep-${prepId}-details`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'preparations', filter: `preparation_id=eq.${prepId}`}, (payload) => {
          appLogger.log(`[useDishDetail] Nested prep UPDATE for ${prepId} received! Invalidating dish ${dishId}.`, payload);
          queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: dishId }] });
          // Also invalidate the specific prep detail cache
          queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: prepId }] });
          setLastUpdateTime(Date.now());
        })
        .subscribe(statusCallback(`NestedPrep-${prepId}`));
      prepListeners.push(prepDetailChannel);
      
      // 2. Listen to the preparation's ingredients
      const prepIngChannel = supabase
        .channel(`dish-${dishId}-prep-${prepId}-ingredients`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'preparation_ingredients', filter: `preparation_id=eq.${prepId}`}, (payload) => {
          appLogger.log(`[useDishDetail] Nested prep ingredients change for ${prepId} received! Invalidating dish ${dishId}.`, payload);
          queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: dishId }] });
           // Also invalidate the specific prep detail cache
          queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: prepId }] });
          setLastUpdateTime(Date.now());
        })
        .subscribe(statusCallback(`NestedPrepIngs-${prepId}`));
      prepListeners.push(prepIngChannel);
      
      // 3. Listen to the linked ingredient for the preparation (name, notes etc.)
      const linkedIngChannel = supabase
        .channel(`dish-${dishId}-prep-${prepId}-linkedIng`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ingredients', filter: `ingredient_id=eq.${prepId}`}, (payload) => {
            appLogger.log(`[useDishDetail] Nested prep linked ingredient UPDATE for ${prepId} received! Invalidating dish ${dishId}.`, payload);
            queryClient.invalidateQueries({ queryKey: ['dish', { dish_id: dishId }] });
             // Also invalidate the specific prep detail cache
            queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: prepId }] });
            setLastUpdateTime(Date.now());
        })
        .subscribe(statusCallback(`NestedPrepLinkedIng-${prepId}`));
      prepListeners.push(linkedIngChannel);
    });

    // Helper for logging subscription status
    function statusCallback(channelName: string) {
        return (status: string, err?: Error) => {
            if (status === 'SUBSCRIBED') {
                appLogger.log(`[useDishDetail] Subscribed to ${channelName}`);
            } else if (err) {
                appLogger.error(`[useDishDetail] Error subscribing to ${channelName}:`, err);
            }
        }
    }

    // Cleanup function
    return () => {
      appLogger.log(`[useDishDetail] Cleaning up listeners for dish ${dishId}`);
      supabase.removeChannel(dishChannel);
      supabase.removeChannel(componentsChannel);
      // Remove dynamic prep listeners
      prepListeners.forEach(channel => supabase.removeChannel(channel));
    };
  // DEPEND ON 'dish' object to re-run effect when components change (e.g., adding/removing a prep)
  }, [dishId, kitchenId, queryClient, dish]); 
  // --- END REALTIME SUBSCRIPTION ---

  // RETURN lastUpdateTime
  return { dish, loading, error: error ? (error as Error) : null, lastUpdateTime };
}

/**
 * Hook to fetch all menu sections (categories) for the current kitchen.
 * ADDED: Realtime subscription to invalidate cache on changes.
 * ADDED: Returns lastUpdateTime to signal Realtime updates.
 */
export function useMenuSections() {
  const kitchenId = useCurrentKitchenId();
  const queryClient = useQueryClient();
  const queryKey = ['menu_section', { kitchen_id: kitchenId }];
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null); // ADDED

  // Define the asynchronous fetch function
  const fetchMenuSections = async () => {
    if (!kitchenId) {
      // Return empty array if kitchenId is not available
      // useQuery's `enabled` option handles this
      return []; 
    }

    const { data, error } = await supabase
      .from('menu_section')
      .select('menu_section_id, name')
      .eq('kitchen_id', kitchenId) // Filter by kitchen ID
      .order('name') as { data: DbMenuSection[] | null, error: any };

    if (error) throw error;

    // Transform data before returning
    return data ? data.map(d => transformMenuSection(d as DbMenuSection)) : [];
  };

  // Use the useQuery hook
  const { 
    data: menuSections, 
    isLoading, // Use isLoading from useQuery
    error, 
    // refetch can be obtained if needed
  } = useQuery({
    queryKey: queryKey,
    queryFn: fetchMenuSections,
    enabled: !!kitchenId, // Only run the query if kitchenId is available
  });

  // --- ADDED REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!kitchenId) return;

    const channel = supabase
      .channel('public:menu_section')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'menu_section',
          // filter: `kitchen_id=eq.${kitchenId}` // Optional filter
        },
        (payload) => {
          appLogger.log('[useMenuSections] Realtime change received!', payload);
          const affectedKitchen = (payload.new as any)?.kitchen_id || (payload.old as any)?.kitchen_id;
          // Only invalidate if the change affects the current kitchen
          if (affectedKitchen === kitchenId) {
             queryClient.invalidateQueries({ queryKey: ['menu_section', { kitchen_id: kitchenId }] });
             setLastUpdateTime(Date.now()); // ADDED: Signal update
          }
        }
      )
      .subscribe((status, err) => {
        // Optional: Log status/errors
        if (status === 'SUBSCRIBED') {
           appLogger.log('[useMenuSections] Realtime channel subscribed');
         } else if (err) {
            appLogger.error('[useMenuSections] Realtime channel error:', err);
         }
      });

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      appLogger.log('[useMenuSections] Realtime channel unsubscribed');
    };
  }, [kitchenId, queryClient]);
  // --- END REALTIME SUBSCRIPTION ---

  // Return values consistent with React Query
  return { 
    menuSections: menuSections ?? [], // Ensure it's always an array
    isLoading, 
    error,
    lastUpdateTime // ADDED
  };
}

/**
 * Hook to fetch a single preparation with its details and ingredients
 * ADDED: Realtime subscription to invalidate cache on changes.
 * ADDED: Returns lastUpdateTime to signal Realtime updates.
 */

export function usePreparationDetail(preparationId: string | undefined) {
  console.log("[usePreparationDetail] Hook called", { preparationId });

  const queryClient = useQueryClient();
  const queryKey = ['preparation', { preparation_id: preparationId }];
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);

  // Define the fetch function to be used if the cache doesn't have the data
  const fetchPreparationDetail = async () => {
    // Handle undefined preparationId
    if (!preparationId) {
        console.log("[usePreparationDetail] fetchPreparationDetail: preparationId is undefined, returning null data");
        return Promise.resolve({ preparation: null, ingredients: [] });
    }

    appLogger.log(`[usePreparationDetail] Fetching details for prep: ${preparationId}`); // Log fetch start

    try {
      // Attempt to load from offline cache first
      try {
        const cachedPayload = await getOfflineRecipe(preparationId, 'prep');
        if (cachedPayload && 'preparation_id' in cachedPayload) {
          appLogger.log(`[usePreparationDetail] Hydrating preparation ${preparationId} from offline cache.`);
          // Force a background refetch after hydrating from cache
          queryClient.invalidateQueries({ queryKey }); 
          
          return {
            preparation: cachedPayload,
            ingredients: cachedPayload.ingredients || [],
          };
        }
      } catch (cacheError) {
        appLogger.warn(`[usePreparationDetail] Cache read failed for ${preparationId}:`, cacheError);
      }

      const { preparation, ingredients } = await fetchPreparationDetailsFromDB(preparationId);

       try {
        const payloadToCache: OfflinePreparationPayload = {
             schemaVersion: 1,
             fetchedAt: Date.now(),
             preparation_id: preparation?.preparation_id || '',
             name: preparation?.name || '',
             directions: preparation?.directions ?? null,
             total_time: preparation?.total_time ?? null,
             yield_amount: preparation?.yield_amount ?? null,
             yield_unit_id: preparation?.yield_unit?.unit_id ?? null,
             yield_unit: preparation?.yield_unit ?? null,
             cooking_notes: preparation?.cooking_notes ?? null,
             ingredients: ingredients || [],
             fingerprint: (preparation as any)?.fingerprint ?? null,
        };
        await saveOfflineRecipe(preparationId, 'prep', payloadToCache);
       } catch (cacheError) {
           console.warn(`[usePreparationDetail] Failed to cache preparation ${preparationId} after fetch:`, cacheError);
       }

      return {
        preparation: preparation,
        ingredients: ingredients,
      };
    } catch (error) {
      appLogger.error(`[usePreparationDetail] Error fetching preparation ${preparationId}:`, error);
    }
  };

  // Use useQuery hook
  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey,
    queryFn: fetchPreparationDetail,
    enabled: !!preparationId,
    staleTime: 5 * 60 * 1000
  });

  // --- MODIFIED: Memoize the ingredients array for stable reference ---
  const memoizedIngredients = useMemo(() => {
    return data?.ingredients || []; 
  }, [data?.ingredients]);

  // --- UPDATED REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!preparationId) {
         console.log(`[usePreparationDetail] Skipping subscriptions - preparationId is undefined.`);
         return;
    }
    console.log(`[usePreparationDetail] Setting up subscriptions for preparation ${preparationId}.`);

    // --- Base listeners for preparation and preparation_ingredients ---
    const prepChannel = supabase
        .channel(`public:preparations:preparation_id=eq.${preparationId}`)
        .on('postgres_changes', {
            event: 'UPDATE', 
            schema: 'public',
            table: 'preparations',
            filter: `preparation_id=eq.${preparationId}`
        }, payload => {
            appLogger.log(`[usePreparationDetail] Prep update for ${preparationId} received:`, payload);
            queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: preparationId }] });
            queryClient.invalidateQueries({ queryKey: ['preparations'] });
             // queryClient.invalidateQueries({ queryKey: ['dishes'] });
             setLastUpdateTime(Date.now());
        })
        .subscribe((status, err) => {
             if (status === 'SUBSCRIBED') {
               appLogger.log(`[usePreparationDetail] Subscribed to preparation ${preparationId}`);
             } else if (err) {
                appLogger.error(`[usePreparationDetail] Error subscribing to preparation ${preparationId}:`, err);
             }
        });

    const prepIngChannel = supabase
        .channel(`public:preparation_ingredients:preparation_id=eq.${preparationId}`)
        .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: 'preparation_ingredients',
            filter: `preparation_id=eq.${preparationId}`
        }, payload => {
            appLogger.log(`[usePreparationDetail] Prep ingredients update for ${preparationId} received:`, payload);
            queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: preparationId }] });
             queryClient.invalidateQueries({ queryKey: ['preparations'] });
             setLastUpdateTime(Date.now());
        })
       .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
               appLogger.log(`[usePreparationDetail] Subscribed to ingredients for preparation ${preparationId}`);
             } else if (err) {
                appLogger.error(`[usePreparationDetail] Error subscribing to ingredients for preparation ${preparationId}:`, err);
             }
        });

    // Preparation data is also linked to the 'ingredients' table for name, notes etc.
    // Subscribe to changes on the linked ingredient row as well.
     const linkedIngChannel = supabase
        .channel(`public:ingredients:ingredient_id=eq.${preparationId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'ingredients',
            filter: `ingredient_id=eq.${preparationId}`
        }, payload => {
            appLogger.log(`[usePreparationDetail] Linked ingredient update for ${preparationId} received:`, payload);
            queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: preparationId }] });
            queryClient.invalidateQueries({ queryKey: ['preparations'] });
            setLastUpdateTime(Date.now());
        })
        .subscribe((status, err) => {
             if (status === 'SUBSCRIBED') {
               appLogger.log(`[usePreparationDetail] Subscribed to linked ingredient ${preparationId}`);
             } else if (err) {
                appLogger.error(`[usePreparationDetail] Error subscribing to linked ingredient ${preparationId}:`, err);
             }
        });
    /*
    const nestedPrepListeners: any[] = [];
    uniquePrepIds.forEach(nestedPrepId => {
        const nestedChannel = supabase
            .channel(`public:preparations:preparation_id=eq.${nestedPrepId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'preparations', filter: `preparation_id=eq.${nestedPrepId}`}, (payload) => {
                 console.log(`[usePreparationDetail] Nested prep ${nestedPrepId} update received!`);
                 queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: preparationId }] }); // Инвалидируем родительский преп
                 queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: nestedPrepId }] }); // Инвалидируем сам вложенный преп
                 setLastUpdateTime(Date.now());
            })
            .subscribe();
        nestedPrepListeners.push(nestedChannel);
    });
    */


    return () => {
        console.log(`[usePreparationDetail] Cleaning up listeners for preparation ${preparationId}`);
        supabase.removeChannel(prepChannel);
        supabase.removeChannel(prepIngChannel);
        supabase.removeChannel(linkedIngChannel);
        appLogger.log(`[usePreparationDetail] Unsubscribed from preparation ${preparationId}`);
    };

   }, [preparationId, queryClient]); 

  console.log('[usePreparationDetail] Returning data:', {
      preparation: data?.preparation || null,
      ingredients: memoizedIngredients,
      loading,
      error: error ? (error as Error) : null,
      lastUpdateTime
  });
  
  return {
    preparation: data?.preparation || null,
    ingredients: memoizedIngredients,
    loading,
    error: error ? (error as Error) : null,
    lastUpdateTime
  };
}

/**
 * Hook to fetch all preparations for the current kitchen.
 * Fetches ingredients that have a corresponding entry in the preparations table.
 * REFACTORED: Use useQuery for fetching and caching.
 * ADDED: Returns lastUpdateTime to signal Realtime updates.
 */
export function usePreparations() {
  const kitchenId = useCurrentKitchenId();
  const queryClient = useQueryClient();
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);

  // Define the query key
  const queryKey = ['preparations', { kitchen_id: kitchenId }];

  // Define the fetch function for useQuery
  const fetchPreparations = async () => {
    if (!kitchenId) {
      return []; 
    }
    
    appLogger.log(`[usePreparations] Fetching preparations for kitchen: ${kitchenId}`); // Log fetch start
    const { data, error: fetchError } = await supabase
        .from('preparations')
        .select(`
          *,
          yield_unit:units!preparations_amount_unit_id_fkey ( * ),
          ingredient:ingredients!preparations_preparation_id_fkey (
            *,
            base_unit:ingredients_unit_id_fkey(*)
          )
        `)
        .eq('ingredient.kitchen_id', kitchenId)
        .order('ingredient(name)', { ascending: true });

    if (fetchError) {
        appLogger.error('[usePreparations] Error fetching:', fetchError);
        throw fetchError;
    }
    
    // --- ADD LOGGING: Raw fetched data ---
    appLogger.log('[usePreparations] Raw data received from Supabase:', JSON.stringify(data, null, 2));
    // --- END LOGGING ---

    // Process the fetched data
    const transformedPreparations = data ? data
      .map((item: any) => {
         // Type assertion for better safety
        const ingredientData = item.ingredient as (FetchedIngredientDetail & { amount: number, kitchen_id: string | null }) | null;
        const prepBaseData = item as FetchedPreparationDetail;

        if (!ingredientData || ingredientData.kitchen_id !== kitchenId) {
             appLogger.warn(`Skipping preparation with unexpected ingredient data: ${prepBaseData.preparation_id}`);
             return null;
        }

        const combinedData: FetchedPreparationDataCombined = {
          ingredient_id: ingredientData.ingredient_id,
          name: ingredientData.name,
          cooking_notes: ingredientData.cooking_notes,
          storage_location: ingredientData.storage_location,
          unit_id: ingredientData.unit_id,
          base_unit: ingredientData.base_unit,
          deleted: ingredientData.deleted,
          kitchen_id: ingredientData.kitchen_id || '',
          synonyms: ingredientData.synonyms,
          preparation_id: prepBaseData.preparation_id,
          directions: prepBaseData.directions,
          total_time: prepBaseData.total_time,
          yield_unit: prepBaseData.yield_unit,
          amount_unit_id: prepBaseData.amount_unit_id,
          fingerprint: prepBaseData.fingerprint,
          amount: ingredientData.amount ?? 0,
          created_at: ingredientData.created_at ?? null,
          updated_at: ingredientData.updated_at ?? null,
        };

        return transformPreparation(combinedData);
    })
    .filter(p => p !== null) as Preparation[] : [];

    return transformedPreparations;
  };

  // Use the useQuery hook
  const { 
    data: preparations, 
    isLoading: loading, // Use isLoading from useQuery
    error, 
    // refetch can be obtained if needed
  } = useQuery({
    queryKey: queryKey,
    queryFn: fetchPreparations,
    enabled: !!kitchenId, // Only run the query if kitchenId is available
  });

   // --- UPDATED REALTIME SUBSCRIPTION (using query invalidation) ---
   useEffect(() => {
     if (!kitchenId) return;

     const invalidateAndSignal = () => {
         appLogger.log('[usePreparations] Invalidating preparations query due to Realtime event');
         queryClient.invalidateQueries({ queryKey: queryKey });
         setLastUpdateTime(Date.now());
     }

     // Listener for preparations table changes
     const prepChannel = supabase
       .channel('public:preparations')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'preparations' }, (payload) => {
           appLogger.log('[usePreparations] Prep table change', payload);
           invalidateAndSignal(); 
           // Also invalidate the specific preparation detail if ID is available
           const newRecord = payload.new as { preparation_id?: string, kitchen_id?: string }; // Assume kitchen_id might be on preparations
           const oldRecord = payload.old as { preparation_id?: string, kitchen_id?: string };
           const prepId = newRecord?.preparation_id ?? oldRecord?.preparation_id;
           // Optional: Check if the change affects the current kitchen if kitchen_id exists on preparations
           // const affectedKitchen = newRecord?.kitchen_id || oldRecord?.kitchen_id;
           // if (affectedKitchen && affectedKitchen !== kitchenId) return; 
           if (prepId) {
               queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: prepId }] });
           }
       })
       .subscribe(statusCallback('Preparations'));

     // Listener for linked ingredients table changes (that are preparations)
     // SIMPLIFIED: Invalidate preparations list on ANY ingredient change in the kitchen.
     // This is less precise but avoids relying on potentially stale cached 'preparations' state.
     // Restore listener
     const ingChannel = supabase
       .channel('public:ingredients')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients', filter: `kitchen_id=eq.${kitchenId}` }, (payload) => { // Listen to all events, filtered by kitchen
           appLogger.log('[usePreparations] Linked ingredient change in kitchen', payload);
           invalidateAndSignal(); // Invalidate the main list

           // Invalidate the specific preparation detail cache IF the changed ingredient IS a preparation
           // We still need *some* way to know if it's a prep. Let's invalidate the specific detail cache anyway,
           // React Query will handle the refetch efficiently if it's not actually the detail being viewed.
           const newRecord = payload.new as { ingredient_id?: string };
           const oldRecord = payload.old as { ingredient_id?: string };
           const ingredientId = newRecord?.ingredient_id ?? oldRecord?.ingredient_id;
           if (ingredientId) {
               queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: ingredientId }] });
           }
       })
       .subscribe(statusCallback('Preparations-LinkedIngredients'));
     // End restore listener

     // Listener for preparation_ingredients table changes
      // Restore listener
      const prepIngChannel = supabase
       .channel('public:preparation_ingredients')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'preparation_ingredients'}, (payload) => {
           // Any change here *could* affect a preparation's details, potentially requiring a list update
           // if derived list data changes (e.g., complexity, cost - though not implemented yet).
           // Primarily, we need to invalidate the specific preparation detail.
           appLogger.log('[usePreparations] Prep ingredients change', payload);
           const newRecord = payload.new as { preparation_id?: string };
           const oldRecord = payload.old as { preparation_id?: string };
           const prepId = newRecord?.preparation_id ?? oldRecord?.preparation_id;

           if (prepId) {
                // Invalidate the specific prep detail cache
                queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: prepId }] });
                // Also invalidate the main list, as the composition changed.
                // Note: This might be redundant if the prepChannel or ingChannel already fired for a related update.
                // queryClient.invalidateQueries({ queryKey: ['preparations', { kitchen_id: kitchenId }] });
                invalidateAndSignal(); // Use helper to signal update and invalidate list
           } else {
               // If no specific prepId, invalidate the whole list as a fallback
               invalidateAndSignal();
           }
       })
       .subscribe(statusCallback('PreparationIngredients'));
     // End restore listener
     
     // --- END Re-enable --- 

     // Helper for logging subscription status
     function statusCallback(channelName: string) {
         return (status: string, err?: Error) => {
             if (status === 'SUBSCRIBED') {
                 appLogger.log(`[usePreparations] Subscribed to ${channelName}`);
             } else if (err) {
                 appLogger.error(`[usePreparations] Error subscribing to ${channelName}:`, err);
             }
         }
     }

     return () => {
       supabase.removeChannel(prepChannel);
       supabase.removeChannel(ingChannel); // Restore cleanup
       supabase.removeChannel(prepIngChannel); // Restore cleanup
       appLogger.log('[usePreparations] Realtime channels unsubscribed');
     };
   }, [kitchenId, queryClient]); 
   // --- END REALTIME SUBSCRIPTION ---

   return {
      // Ensure preparations is always an array
      preparations: preparations ?? [], 
      loading, 
      error, 
      lastUpdateTime 
    };
 }


/**
 * Hook to search dishes within the current kitchen
 */
export function useDishSearch(searchQuery: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    async function searchDishes() {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }
      
      if (!kitchenId) {
        // Don't set error, just clear results if no kitchen ID
        setResults([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('dishes')
          .select('dish_id, dish_name')
          .eq('kitchen_id', kitchenId) // Filter by kitchen ID
          .ilike('dish_name', `%${searchQuery}%`)
          .order('dish_name');

        if (error) throw error;

        setResults(data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        appLogger.error('Error searching dishes:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    const debounceTimeout = setTimeout(() => {
      searchDishes();
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, kitchenId]); // Re-run if search query or kitchenId changes

  return { results, loading, error };
}


/**
 * Hook to fetch all Units (Assumed Global / Not Kitchen Specific)
 */
export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUnits() {
      // No kitchenId filtering applied to units, assuming they are global
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
          .from('units')
          .select('*')
          .order('unit_name');

        if (fetchError) throw fetchError;

        setUnits(data ? data.map(u => transformUnit(u as DbUnit)) : []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        appLogger.error('Error fetching units:', err);
        setUnits([]);
      } finally {
        setLoading(false);
      }
    }
    fetchUnits();
  }, []);

  return { units, loading, error };
}


/**
 * Hook to fetch ingredients for the current kitchen, optionally identifying which are preparations.
 * ADDED: Realtime subscription to invalidate cache on changes.
 */
export function useIngredients(identifyPreparations: boolean = false) {
  // No queryClient needed here, using useState
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const kitchenId = useCurrentKitchenId();

  // Fetch logic wrapped in useCallback
  const fetchIngredients = useCallback(async () => {
     if (!kitchenId) {
        setError(new Error("Kitchen ID not available. Cannot fetch ingredients."));
        setLoading(false);
        setIngredients([]);
        return;
      }

      try {
        // setLoading(true); // Managed elsewhere
        setError(null);

        // Base query for ingredients filtered by kitchen ID
        let query = supabase
          .from('ingredients')
          .select('*, base_unit:ingredients_unit_id_fkey(*)')
          .eq('kitchen_id', kitchenId); // Filter by kitchen ID


        if (identifyPreparations) {
             // ... (existing logic for identifying preparations) ...
                        // Fetch ingredients first
            const { data: ingredientsData, error: ingredientsError } = await query
                .order('name') as { data: FetchedIngredientDetail[] | null, error: any };

            if (ingredientsError) throw ingredientsError;
            if (!ingredientsData) {
                 setIngredients([]);
                 setLoading(false);
                 return;
            }

            // Get IDs of ingredients that are also preparations (within the current kitchen)
            // We need to ensure preparations are also filtered by kitchen_id if they have that column,
            // or rely on the ingredient join filter if preparations don't have kitchen_id directly.
            const ingredientIds = ingredientsData.map(ing => ing.ingredient_id);
            const { data: prepIdsData, error: prepIdsError } = await supabase
                .from('preparations')
                .select('preparation_id')
                .in('preparation_id', ingredientIds); // Only check among ingredients already fetched for this kitchen

            if (prepIdsError) throw prepIdsError;

            const preparationIds = new Set(prepIdsData?.map(p => p.preparation_id) || []);

            const combinedIngredients = ingredientsData.map(ing => ({
                ...transformIngredient(ing),
                isPreparation: preparationIds.has(ing.ingredient_id),
                base_unit: transformUnit(ing.base_unit)
            }));

            setIngredients(combinedIngredients as Ingredient[]);

        } else {
            // Fetch only ingredients without checking preparation status
            const { data, error: fetchError } = await query.order('name') as { data: FetchedIngredientDetail[] | null, error: any };
            if (fetchError) throw fetchError;
            setIngredients(data ? data.map(ing => transformIngredient(ing)) : []);
        }

      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        appLogger.error('Error fetching ingredients:', err);
        setIngredients([]);
      } finally {
        // setLoading(false); // Managed elsewhere
      }
  }, [identifyPreparations, kitchenId]);

  // Initial Fetch
  useEffect(() => {
      setLoading(true);
      fetchIngredients().finally(() => setLoading(false));
  }, [fetchIngredients]);


   // --- ADDED REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!kitchenId) return;

    const handleIngredientChange = (payload: any) => {
        appLogger.log('[useIngredients] Ingredient change received:', payload);
        setLoading(true);
        fetchIngredients().finally(() => setLoading(false));

         // Safely access ingredient_id from payload
         const newRecord = payload.new as { ingredient_id?: string };
         const oldRecord = payload.old as { ingredient_id?: string };
         const ingredientId = newRecord?.ingredient_id ?? oldRecord?.ingredient_id;
         const isPrep = ingredients.some(ing => ing.ingredient_id === ingredientId && ing.isPreparation);

         if (ingredientId && isPrep) {
             queryClient.invalidateQueries({ queryKey: ['preparations'] });
             queryClient.invalidateQueries({ queryKey: ['preparation', { preparation_id: ingredientId }] });
         }
    };

    const channel = supabase
      .channel('public:ingredients')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'ingredients',
          filter: `kitchen_id=eq.${kitchenId}` // Filter by kitchen ID on the server
        },
        handleIngredientChange
      )
      .subscribe((status, err) => {
           if (status === 'SUBSCRIBED') {
               appLogger.log('[useIngredients] Realtime channel subscribed');
           } else if (err) {
               appLogger.error('[useIngredients] Realtime channel error:', err);
           }
      });

    return () => {
      supabase.removeChannel(channel);
       appLogger.log('[useIngredients] Realtime channel unsubscribed');
    };
    // Include ingredients in dependencies to check if an updated ingredient is a prep
  }, [kitchenId, fetchIngredients, identifyPreparations, ingredients]);
  // --- END REALTIME SUBSCRIPTION ---


  return { ingredients, loading, error };
}

/**
 * Type for the items returned in the ingredients list of usePreparationDetail.
 * It can represent either a raw ingredient or a nested preparation.
 */
export type PreparationComponentDetail = {
  isPreparation: boolean;
  id: string; // ingredient_id
  name: string;
  amount: number | null;
  unit: Unit | null;
  // Details specific to nested preparations
  preparationDetails?: {
    total_time: number | null;
    yield_unit: Unit | null;
    yield_amount: number | null;
    ingredients: PreparationIngredient[]; // Add ingredients for nested preps
  } | null;
  // Details specific to raw ingredients
  rawIngredientDetails?: {
     cooking_notes: string | null;
     // Add other raw ingredient specific details if needed
  } | null;
}; 