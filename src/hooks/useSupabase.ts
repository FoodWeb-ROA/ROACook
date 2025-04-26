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
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../data/supabaseClient';
import { Dish, DishComponent, Ingredient, Unit, MenuSection, Preparation, PreparationIngredient } from '../types';
import { transformDish, transformDishComponent, transformPreparation, transformMenuSection, transformPreparationIngredient, transformUnit, transformIngredient, FetchedDishData, DbMenuSection, FetchedBaseComponent, FetchedIngredientDetail, FetchedPreparationDetail, FetchedPreparationIngredient, AssembledComponentData, DbDishComponent, DbUnit, FetchedPreparationDataCombined } from '../utils/transforms';
import { useAuth } from '../context/AuthContext'; // Import useAuth
// ADDED: Import offline caching helpers
import { getOfflineRecipe, saveOfflineRecipe, OfflineDishPayload, OfflinePreparationPayload } from '../persistence/offlineRecipes';
// ADDED: Import useQuery and QueryClient
import { useQuery } from '@tanstack/react-query'; 
import { queryClient } from '../components/ReactQueryClientProvider'; // Shared client

/**
 * Custom hook to get the current kitchen ID for the authenticated user.
 * Fetches the kitchen_id from the kitchen_users table based on auth.users.id.
 */
export function useCurrentKitchenId(): string | null {
  const [kitchenId, setKitchenId] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth(); // Get user and auth loading state

  useEffect(() => {
    // Don't fetch if auth is still loading or user is not available
    if (authLoading || !user) {
      // Optionally set kitchenId to null explicitly if auth state changes to loading/null
      if (!authLoading && !user) setKitchenId(null); 
      return;
    }

    async function fetchKitchenId() {
       // Add explicit check for user before accessing user.id
       if (!user) return;

      try {
        // Fetch kitchen_id from kitchen_users table based on the current user's ID
        const { data, error } = await supabase
          .from('kitchen_users')
          .select('kitchen_id')
          .eq('user_id', user.id) // Safe to access user.id now
          .limit(1)
          .single();

        if (error) {
          // Handle specific errors e.g., RLS violation or row not found if using .single() without maybeSingle()
          if (error.code === 'PGRST116') { // Error code for single row not found
             // Add explicit check for user before accessing user.id
             if (user) {
               console.warn(`No kitchen link found for user ${user.id}`);
             }
          } else {
            console.error('Error fetching kitchen_id:', error);
          }
          setKitchenId(null); // Set to null on error
          return;
        }

        if (data) {
          setKitchenId(data.kitchen_id);
        } else {
          // This case might be redundant if .single() throws an error when not found
          console.warn('No kitchen associated with this user (data was null).');
          setKitchenId(null); 
        }
      } catch (catchError) {
        console.error('Unexpected error in kitchen ID fetch:', catchError);
        setKitchenId(null); // Set to null on unexpected error
      }
    }

    fetchKitchenId();
  // Depend on user object (or user.id) and authLoading state
  }, [user, authLoading]); 

  return kitchenId;
}

/**
 * Hook to fetch all dishes for the current kitchen, with optional filter by menu section.
 * REFACTORED: Uses TanStack Query (useQuery) for caching and automatic updates.
 */
export function useDishes(menuSectionId?: string) {
  // Define kitchenId using the hook
  const kitchenId = useCurrentKitchenId();

  // Define the query key - includes table name and filters
  const queryKey = ['dishes', { kitchen_id: kitchenId, menu_section_id: menuSectionId }];

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
            console.error(`Error fetching components for dish ${dish.dish_id}:`, componentsError);
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

  // Return the data, loading state, and error in a compatible format
  // Ensure dishes is always an array, even if data is undefined initially
  return { dishes: dishes ?? [], loading, error }; 
}

/**
 * Hook to fetch a single dish for the current kitchen.
 */
export type DishWithDetails = Dish & {
    serving_unit?: Unit | null;
    components: DishComponent[];
};

export function useDishDetail(dishId: string | undefined, kitchenId: string | null) {
  const [dish, setDish] = useState<DishWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    async function fetchDishDetail() {
      // Handle undefined dishId
      if (!dishId) {
        setLoading(false);
        setDish(null);
        setError(null);
        return;
      }

      // Attempt to load from offline cache first
      setLoading(true);
      setError(null);
      setDish(null); // Clear previous state
      let loadedFromCache = false; // Flag to track cache hydration
      try {
        const cachedPayload = await getOfflineRecipe(dishId, 'dish');
        // Use type guard based on the 'kind' used in getOfflineRecipe
        if (cachedPayload && 'dish_id' in cachedPayload) { // Check if it's actually a dish payload
           const cachedDish = cachedPayload as OfflineDishPayload;
           console.log(`[useDishDetail] Hydrating dish ${dishId} from offline cache.`);
           // Explicitly map from cached payload to DishWithDetails
           setDish({
               dish_id: cachedDish.dish_id,
               dish_name: cachedDish.dish_name,
               directions: cachedDish.directions,
               total_time: cachedDish.total_time,
               serving_size: cachedDish.serving_size,
               serving_unit: cachedDish.serving_unit ?? null, // Ensure null if undefined
               num_servings: cachedDish.num_servings, // ADDED: Map num_servings
               cooking_notes: cachedDish.cooking_notes,
               serving_item: cachedDish.serving_item,
               components: cachedDish.components,
               // Fields not in cache need default/null values if required by DishWithDetails
               menu_section: null, // Example: menu_section not cached
           });
           setLoading(false); // Show cached data immediately
           loadedFromCache = true;
        }
      } catch (cacheError) {
        console.error(`[useDishDetail] Error reading offline cache for dish ${dishId}:`, cacheError);
        // Proceed to fetch from network
      }

      // Check kitchenId *after* attempting cache load
      if (!kitchenId) {
        if (!loadedFromCache) { // Only set error if not hydrated from cache
          setError(new Error("Kitchen ID not provided. Cannot fetch dish details."));
           setLoading(false); // Stop loading if we can't fetch
        } else {
           console.warn("[useDishDetail] Kitchen ID not available, cannot refresh from network.");
           setLoading(false); // Stop loading indicator if showing cached data
        }
        return;
      }

      // If cache load failed, ensure loading is true.
      if (!loadedFromCache) {
      setLoading(true);
      }

      try {
        // Fetch the dish, ensuring it belongs to the current kitchen
        const { data: dishData, error: dishError } = await supabase
          .from('dishes')
            .select(`
              *,
              menu_section:menu_section_id(*),
              serving_unit:units!dishes_serving_unit_fkey(*),
              serving_item
            `)
          .eq('dish_id', dishId)
          .eq('kitchen_id', kitchenId) // Filter by kitchen ID
          .single() as { data: FetchedDishData | null, error: any };

        if (dishError) {
          // Handle case where dish exists but doesn't belong to this kitchen (returns error)
          // or other select errors
          console.error('Error fetching dish details:', dishError);
          // If we loaded from cache, don't clear it on network error
          if (!dish) {
             setDish(null);
             setError(dishError);
          } else {
             console.warn(`[useDishDetail] Network fetch failed for ${dishId}, showing cached version.`);
          }
          return; // Keep existing state (cached or null)
        }

        if (!dishData) {
          // Dish not found or doesn't belong to this kitchen
          console.warn(`Dish ${dishId} not found or access denied.`);
          // If we have a cached version, maybe we should purge it? Or keep showing it?
          // Let's purge it for consistency.
          // await purgeOfflineRecipe(dishId, 'dish'); // Need purge function here
          setDish(null);
          setError(new Error(`Dish ${dishId} not found.`)); // Set specific error
          return;
        }


        // Fetch components for the dish
        const { data: dishComponentsData, error: componentsError } = await supabase
          .from('dish_components')
            .select(`
                *,
                unit:fk_components_unit(*),
                ingredient:fk_components_ing (
                  *,
                  base_unit:ingredients_unit_id_fkey ( * ),
                  preparation:preparations!preparation_id (
                      *,                             
                      amount_unit:amount_unit_id(*)
                  )
                )
             `)
          .eq('dish_id', dishId) as { data: (DbDishComponent & { unit: DbUnit | null, ingredient: (FetchedIngredientDetail & { preparation: FetchedPreparationDetail | null }) | null })[] | null, error: any };


        if (componentsError) {
          console.error(`Error fetching components for dish ${dishId}:`, componentsError);
          // If we loaded from cache, don't overwrite with incomplete data
          if (!dish) {
            setError(componentsError); // Set error only if not showing cached data
            setDish(null); // Clear dish if network fetch failed partially
          }
          return; // Keep existing state (cached or null)
        }


        // Transform fetched data
        const transformedDishBase = transformDish(dishData as FetchedDishData);
        const typedComponents = dishComponentsData || [];
        const transformedComponents = await Promise.all(typedComponents.map(async comp => {
            const ingredientData = comp.ingredient as (FetchedIngredientDetail & { preparation: FetchedPreparationDetail | null }) | null;
            
            // If this is a preparation, fetch its ingredients
            let prepIngredients: PreparationIngredient[] = [];
            if (ingredientData?.preparation) {
                const { data: prepIngredientsData, error: prepIngredientsError } = await supabase
                    .from('preparation_ingredients')
                    .select(`
                        *,
                        unit:unit_id(*),
                        ingredient:ingredient_id(*)
                    `)
                    .eq('preparation_id', ingredientData.ingredient_id) as { 
                        data: FetchedPreparationIngredient[] | null, 
                        error: any 
                    };
                    
                if (!prepIngredientsError && prepIngredientsData) {
                    prepIngredients = prepIngredientsData.map(transformPreparationIngredient);
                }
            }
            
            const assembledData: AssembledComponentData = {
                dish_id: dishId!, // Use dishId which is guaranteed non-null here
                baseComponent: {
                    ingredient_id: comp.ingredient_id,
                    unit_id: comp.unit_id,
                    amount: comp.amount,
                    piece_type: comp.piece_type
                } as FetchedBaseComponent,
                ingredient: ingredientData ?? undefined,
                preparation: ingredientData?.preparation ?? undefined,
                componentUnit: comp.unit ?? undefined,
                prepIngredients: prepIngredients
            };
            return transformDishComponent(assembledData); 
        }));

        const finalDishData: DishWithDetails = {
          ...transformedDishBase,
          serving_unit: dishData.serving_unit ? transformUnit(dishData.serving_unit) : null,
          components: transformedComponents,
          serving_item: dishData.serving_item ?? null,
          num_servings: dishData.num_servings ?? 1,
          menu_section: dishData.menu_section ? transformMenuSection(dishData.menu_section) : null,
        };

        // Set final state
        setDish(finalDishData);
        setError(null); // Clear any previous errors

        // Save the fetched data to offline cache
        const payloadToCache: OfflineDishPayload = {
            schemaVersion: 1,
            fetchedAt: 0,
            dish_id: finalDishData.dish_id,
            dish_name: finalDishData.dish_name,
            directions: finalDishData.directions,
            total_time: finalDishData.total_time,
            serving_size: finalDishData.serving_size,
            serving_unit_id: finalDishData.serving_unit?.unit_id ?? null,
            serving_unit: finalDishData.serving_unit ?? null,
            num_servings: finalDishData.num_servings ?? 1,
            cooking_notes: finalDishData.cooking_notes,
            serving_item: finalDishData.serving_item ?? null,
            components: finalDishData.components,
        };
        await saveOfflineRecipe(dishId, 'dish', payloadToCache);

      } catch (err) {
        console.error(`Unexpected error fetching dish ${dishId}:`, err);
        // Only update state if not showing cached data
        if (!dish) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setDish(null);
        }
      } finally {
         if (!loadedFromCache || error) { // Adjust condition based on flag
        setLoading(false);
        }
      }
    }

    fetchDishDetail();
    // Dependency array should include kitchenId to refetch if it changes
    // Also include dishId to refetch if the target dish changes
  }, [dishId, kitchenId]);

  return { dish, loading, error };
}

/**
 * Hook to fetch all menu sections (categories) for the current kitchen.
 */
export function useMenuSections() {
  const [menuSections, setMenuSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  const refresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    async function fetchMenuSections() {
        if (!kitchenId) {
            // This is the state we want:
            setError(new Error("Kitchen ID not available. Cannot fetch menu sections."));
            // setLoading(false); // This line should be removed/commented out
            setMenuSections([]);
            return;
        }

        try {
          setLoading(true);
          setError(null);

          const { data, error } = await supabase
            .from('menu_section')
            .select('menu_section_id, name')
            .eq('kitchen_id', kitchenId) // Filter by kitchen ID
            .order('name') as { data: DbMenuSection[] | null, error: any };

          if (error) throw error;

          setMenuSections(data ? data.map(d => transformMenuSection(d as DbMenuSection)) : []);
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)));
          console.error('Error fetching menu sections:', err);
          setMenuSections([]); // Clear sections on error
        } finally {
          setLoading(false);
        }
    }

    fetchMenuSections();
  }, [kitchenId]); // Dependency array

  return { menuSections, loading, error, refresh };
}

/**
 * Hook to fetch a single preparation with its details and ingredients
 */
export function usePreparationDetail(preparationId: string | undefined) {
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [ingredients, setIngredients] = useState<PreparationIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    async function fetchPreparationDetails() {
      if (!preparationId) {
        setLoading(false);
        setPreparation(null);
        setIngredients([]);
        setError(null);
        return;
      }

      // Attempt to load from offline cache first
      setLoading(true);
      setError(null);
      setPreparation(null); // Clear previous state
      setIngredients([]);
      let loadedFromCache = false; // Flag
      try {
        const cachedPayload = await getOfflineRecipe(preparationId, 'prep');
        // Use type guard based on the 'kind' used in getOfflineRecipe
        if (cachedPayload && 'preparation_id' in cachedPayload) { // Check if it's a prep payload
          const cachedPrep = cachedPayload as OfflinePreparationPayload;
          console.log(`[usePreparationDetail] Hydrating prep ${preparationId} from offline cache.`);

          // Map from cached payload to Preparation state object
          setPreparation({
              preparation_id: cachedPrep.preparation_id,
              name: cachedPrep.name,
              directions: cachedPrep.directions,
              total_time: cachedPrep.total_time,
              yield_amount: cachedPrep.yield_amount,
              yield_unit: cachedPrep.yield_unit ?? null, // Ensure null if undefined
              cooking_notes: cachedPrep.cooking_notes,
              reference_ingredient: cachedPrep.reference_ingredient,
              ingredients: [], // ingredients are handled by the separate state
          });
          setIngredients(cachedPrep.ingredients || []);
          setLoading(false); // Show cached data immediately
          loadedFromCache = true;
        }
      } catch (cacheError) {
         console.error(`[usePreparationDetail] Error reading offline cache for prep ${preparationId}:`, cacheError);
         // Proceed to fetch from network
      }

       // Check kitchenId *after* attempting cache load
      if (!kitchenId) {
         if (!loadedFromCache) { // Only set error if not hydrated from cache
        setError(new Error("Kitchen ID not available. Cannot fetch preparation details."));
           setLoading(false); // Stop loading if we can't fetch
         } else {
           console.warn("[usePreparationDetail] Kitchen ID not available, cannot refresh from network.");
           setLoading(false); // Stop loading indicator if showing cached data
         }
        return;
      }

      // Ensure loading is true if cache read failed
      if (!loadedFromCache) {
      setLoading(true);
      }

      try {
        // Fetch the base ingredient details (which includes yield amount/unit)
        const { data: ingredientData, error: ingredientError } = await supabase
            .from('ingredients')
            .select(`
              *,
              unit:unit_id(*)
            `)
            .eq('ingredient_id', preparationId)
          .eq('kitchen_id', kitchenId) // Ensure it belongs to the correct kitchen
          .single() as { data: FetchedIngredientDetail | null, error: any };


        if (ingredientError || !ingredientData) {
          console.error('Error fetching base ingredient details for preparation:', ingredientError);
          if (!preparation) { // Only update state if not showing cache
             setPreparation(null);
             setIngredients([]);
             setError(ingredientError || new Error(`Preparation base ingredient ${preparationId} not found.`));
          } else {
             console.warn(`[usePreparationDetail] Network fetch failed for prep base ${preparationId}, showing cached version.`);
          }
          return;
        }

        // Fetch the preparation-specific details
        const { data: prepData, error: prepError } = await supabase
          .from('preparations')
          .select(`
              *,
              amount_unit:amount_unit_id(*)
          `)
          .eq('preparation_id', preparationId)
          .single() as { data: FetchedPreparationDetail | null, error: any };


        if (prepError || !prepData) {
          console.error('Error fetching preparation details:', prepError);
           if (!preparation) { // Only update state if not showing cache
              setPreparation(null);
              setIngredients([]);
              setError(prepError || new Error(`Preparation details ${preparationId} not found.`));
          } else {
              console.warn(`[usePreparationDetail] Network fetch failed for prep details ${preparationId}, showing cached version.`);
          }
          return;
        }


        // Fetch the ingredients used in the preparation
        const { data: prepIngredientsData, error: prepIngredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
              *,
              unit:unit_id(*),
              ingredient:ingredient_id(*)
          `)
          .eq('preparation_id', preparationId) as { data: FetchedPreparationIngredient[] | null, error: any };


        if (prepIngredientsError) {
          console.error(`Error fetching preparation ingredients for ${preparationId}:`, prepIngredientsError);
           if (!preparation) { // Only update state if not showing cache
               setPreparation(null); // Clear potentially incomplete data
               setIngredients([]);
               setError(prepIngredientsError);
              } else {
               console.warn(`[usePreparationDetail] Network fetch failed for prep ingredients ${preparationId}, showing cached version.`);
           }
          return;
        }

        // Prepare the single COMBINED object argument for transformPreparation
        const combinedDataForTransform: FetchedPreparationDataCombined = {
            // Fields from FetchedIngredientDetail (Omit created_at, updated_at)
            ...(ingredientData as FetchedIngredientDetail),
            // Fields from FetchedPreparationDetail (Omit created_at)
            ...(prepData as FetchedPreparationDetail),
            amount: (ingredientData as FetchedIngredientDetail).amount ?? 0, 
            created_at: (ingredientData as FetchedIngredientDetail).created_at ?? null,
            updated_at: (ingredientData as FetchedIngredientDetail).updated_at ?? null,
        };

        // Call transformPreparation with the correctly structured single object
        const transformedPreparation = transformPreparation(combinedDataForTransform);

        const transformedIngredients = (prepIngredientsData || []).map(transformPreparationIngredient);

        // Check if any ingredients are also preparations
        if (transformedIngredients.length > 0) {
          const ingredientIds = transformedIngredients.map(ing => ing.ingredient_id);
          
          // Fetch any ingredient ids that match preparations
          const { data: prepMatchData, error: prepMatchError } = await supabase
            .from('preparations')
            .select('preparation_id')
            .in('preparation_id', ingredientIds);
          
          if (!prepMatchError && prepMatchData) {
            // Create a set of preparation IDs for quick lookup
            const preparationIds = new Set(prepMatchData.map(p => p.preparation_id));
            
            // Mark ingredients that are preparations
            transformedIngredients.forEach(ing => {
              // @ts-ignore - Adding isPreparation property to match expected format
              ing.isPreparation = preparationIds.has(ing.ingredient_id);
            });
          }
        }

        // Set final state
        setPreparation(transformedPreparation);
        setIngredients(transformedIngredients);
        setError(null); // Clear previous errors

        // Save the combined fetched data to offline cache
        const payloadToCache: OfflinePreparationPayload = {
           schemaVersion: 1,
           fetchedAt: 0,
           preparation_id: transformedPreparation.preparation_id,
           name: transformedPreparation.name,
           directions: transformedPreparation.directions,
           total_time: transformedPreparation.total_time,
           yield_amount: transformedPreparation.yield_amount,
           yield_unit_id: transformedPreparation.yield_unit?.unit_id ?? null,
           yield_unit: transformedPreparation.yield_unit ?? null,
           cooking_notes: transformedPreparation.cooking_notes,
           reference_ingredient: transformedPreparation.reference_ingredient,
           ingredients: transformedIngredients,
           fingerprint: (prepData as any)?.fingerprint ?? null
        };
        await saveOfflineRecipe(preparationId, 'prep', payloadToCache);

      } catch (err) {
        console.error(`Unexpected error fetching preparation ${preparationId}:`, err);
         if (!preparation) { // Only update state if not showing cache
        setError(err instanceof Error ? err : new Error(String(err)));
            setPreparation(null);
            setIngredients([]);
         }
      } finally {
         if (!loadedFromCache || error) { // Adjust condition
        setLoading(false);
         }
      }
    }

    fetchPreparationDetails();
  }, [preparationId, kitchenId]);

  return { preparation, ingredients, loading, error };
}

/**
 * Hook to fetch all preparations for the current kitchen.
 * Fetches ingredients that have a corresponding entry in the preparations table.
 */
export function usePreparations() {
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    async function fetchPreparations() {
      if (!kitchenId) {
        setError(new Error("Kitchen ID not available. Cannot fetch preparations."));
        setLoading(false);
        setPreparations([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch preparations by joining through ingredients filtered by kitchen_id
        // This assumes 'ingredients' has 'kitchen_id' and 'preparations' relates to 'ingredients' via 'preparation_id' = 'ingredient_id'
        const { data, error: fetchError } = await supabase
          .from('preparations') // Start from preparations
          .select(`
            preparation_id,
            directions,
            total_time,
            yield_unit:units!preparations_amount_unit_id_fkey ( * ),
            ingredient:ingredients!preparations_preparation_id_fkey (
              ingredient_id,
              name,
              cooking_notes,
              storage_location,
              unit_id,
              amount,
              kitchen_id,
              base_unit:ingredients_unit_id_fkey(*)
            )
          `)
          // Use less type-safe access for joined column until types are updated
          .eq('ingredient.kitchen_id', kitchenId)
          .order('ingredient(name)'); // Order by the ingredient name

        if (fetchError) throw fetchError;

        // Process the fetched data
        const transformedPreparations = data ? data.map((item: any) => {
            const ingredientData = item.ingredient as (FetchedIngredientDetail & { amount: number });
            // Use type assertion (as any) for less safe access until types are updated
            if (!ingredientData || (ingredientData as any).kitchen_id !== kitchenId) {
                 console.warn(`Skipping preparation with unexpected ingredient data: ${item.preparation_id}`);
                 return null;
            }

            const prepData = {
                preparation_id: item.preparation_id,
                directions: item.directions,
                total_time: item.total_time,
                yield_unit: item.yield_unit
            } as FetchedPreparationDetail;

            const combinedData = { ...ingredientData, ...prepData };

            return transformPreparation(combinedData as any);
        }).filter(p => p !== null) as Preparation[] : []; // Filter out nulls

        setPreparations(transformedPreparations);

      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching preparations:', err);
        setPreparations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPreparations();
  }, [kitchenId]); // Run once on mount or when kitchenId changes

  return { preparations, loading, error };
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
        console.error('Error searching dishes:', err);
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
        console.error('Error fetching units:', err);
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
 */
export function useIngredients(identifyPreparations: boolean = false) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    async function fetchIngredients() {
      if (!kitchenId) {
        setError(new Error("Kitchen ID not available. Cannot fetch ingredients."));
        setLoading(false);
        setIngredients([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Base query for ingredients filtered by kitchen ID
        let query = supabase
          .from('ingredients')
          .select('*, base_unit:ingredients_unit_id_fkey(*)')
          .eq('kitchen_id', kitchenId); // Filter by kitchen ID

        if (identifyPreparations) {
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
                ...transformIngredient(ing), // Transform base ingredient
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
        console.error('Error fetching ingredients:', err);
        setIngredients([]);
      } finally {
        setLoading(false);
      }
    }

    fetchIngredients();
  }, [identifyPreparations, kitchenId]); // Re-run if flag or kitchenId changes

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
    reference_ingredient?: string | null; // Make reference_ingredient optional
  } | null;
  // Details specific to raw ingredients
  rawIngredientDetails?: {
     cooking_notes: string | null;
     // Add other raw ingredient specific details if needed
  } | null;
}; 