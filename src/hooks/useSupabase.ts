import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../data/supabaseClient';
import { Dish, DishComponent, Ingredient, Unit, MenuSection, Preparation, PreparationIngredient } from '../types';
import { transformDish, transformDishComponent, transformPreparation, transformMenuSection, transformPreparationIngredient, transformUnit, transformIngredient, FetchedDishData, DbMenuSection, FetchedBaseComponent, FetchedIngredientDetail, FetchedPreparationDetail, FetchedPreparationIngredient, AssembledComponentData, DbDishComponent, DbUnit } from '../utils/transforms';
import { useAuth } from '../context/AuthContext'; // Import useAuth

/**
 * Custom hook to get the current kitchen ID based on the environment.
 * In development (__DEV__ = true), uses the EXPO_PUBLIC_DEFAULT_KITCHEN_ID env variable.
 * In production (__DEV__ = false), uses the kitchen_id from the authenticated user context.
 */
function useCurrentKitchenId(): string | null {
  if (__DEV__) {
    // --- Development Logic (Using .env variable) ---
    const kitchenId = process.env.EXPO_PUBLIC_DEFAULT_KITCHEN_ID;
    if (!kitchenId) {
      console.error('DEV Error: EXPO_PUBLIC_DEFAULT_KITCHEN_ID environment variable is not set.');
      return null;
    }
    // Log warning only once or less frequently if needed, but helpful during dev
    console.warn('DEV MODE: Using default kitchen ID from environment variable.');
    return kitchenId;
    // --- End Development Logic ---
  } else {
    // --- Production/Auth Logic --- 
    const { user } = useAuth(); // Get user from context
    // Adjust 'kitchen_id' based on the actual structure of your user object from useAuth
    // Try accessing via user_metadata first
    const kitchenId = user?.user_metadata?.kitchen_id; 

    if (!user) {
      // This case might happen briefly during loading or if auth state is lost
      console.warn('PROD WARN: User context not available yet for retrieving kitchen ID.');
      return null; 
    }
    
    if (!kitchenId) {
      console.error('PROD Error: Could not retrieve kitchen_id from authenticated user object.', user);
      // Depending on requirements, you might throw an error or handle this state differently
      return null;
    }
    return kitchenId;
    // --- End Production/Auth Logic ---
  }
}

/**
 * Hook to fetch all dishes for the current kitchen, with optional filter by menu section.
 */
export function useDishes(menuSectionId?: string) {
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    // kitchenId is now available from the outer scope
    async function fetchDishes() {
      if (!kitchenId) {
        setError(new Error("Kitchen ID not available. Cannot fetch dishes."));
        setLoading(false);
        setDishes([]);
        return;
      }

      try {
        setLoading(true);
        setError(null); // Reset error on new fetch

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
          .eq('kitchen_id', kitchenId); // Filter by kitchen ID

        if (menuSectionId) {
          query = query.eq('menu_section_id', menuSectionId);
        }

        const { data: dishesData, error: dishesError } = await query.order('dish_name') as { data: FetchedDishData[] | null, error: any };

        if (dishesError) throw dishesError;
        if (!dishesData) {
            setDishes([]);
            setLoading(false);
            return;
        }

        const dishesWithComponents = await Promise.all(dishesData.map(async (dish) => {
          const { data: dishComponents, error: componentsError } = await supabase
            .from('dish_components')
            .select(`
              *,
              unit:fk_components_unit(*),
              ingredient:fk_components_ing (
                *,
                base_unit:ingredients_unit_id_fkey ( * ),
                preparation:preparations!preparation_id (
                    *
                )
              )
            `)
            .eq('dish_id', dish.dish_id) as { data: (DbDishComponent & { unit: DbUnit | null, ingredient: (FetchedIngredientDetail & { preparation: FetchedPreparationDetail | null }) | null })[] | null, error: any };

          if (componentsError) {
            console.error(`Error fetching components for dish ${dish.dish_id}:`, componentsError);
            // Return dish data even if components fail to load for that specific dish
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
                    amount: comp.amount
                },
                ingredient: ingredientData ?? undefined,
                preparation: ingredientData?.preparation ?? undefined,
                componentUnit: comp.unit ?? undefined,
                prepIngredients: undefined // Prep ingredients are fetched in usePreparationDetail if needed
            };
            return transformDishComponent(assembledData);
          }) : [];

          return { ...transformDish(dish as FetchedDishData), components: transformedComponents };
        }));

        setDishes(dishesWithComponents || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching dishes:', err);
        setDishes([]); // Clear dishes on error
      } finally {
        setLoading(false);
      }
    }

    fetchDishes();
    // Dependency array can now correctly reference kitchenId from the outer scope
  }, [menuSectionId, kitchenId]);

  return { dishes, loading, error };
}

/**
 * Hook to fetch a single dish for the current kitchen.
 */
export type DishWithDetails = Dish & {
    serving_unit?: Unit | null;
    components: DishComponent[];
};

export function useDishDetail(dishId: string | undefined) {
  const [dish, setDish] = useState<DishWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  const refresh = useCallback(async () => {
    // kitchenId is now available from the outer scope
    if (!dishId) {
      setLoading(false);
      setDish(null);
      setError(null);
      return;
    }

    if (!kitchenId) {
      setError(new Error("Kitchen ID not available. Cannot fetch dish details."));
      setLoading(false);
      setDish(null);
      return;
    }

    setLoading(true);
    setError(null);
    setDish(null);

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
        throw dishError;
      }
      // If data is null after a single() call without error, it means the dish wasn't found (or didn't match kitchen_id)
      if (!dishData) throw new Error('Dish not found or access denied.');

      // Fetching components, ingredients, units etc. continues as before,
      // implicitly scoped by the already validated dish_id.
      const { data: baseComponents, error: baseCompError } = await supabase
        .from('dish_components')
        .select('ingredient_id, unit_id, amount')
        .eq('dish_id', dishId) as { data: FetchedBaseComponent[] | null, error: any };

      if (baseCompError) throw baseCompError;

      let finalComponents: DishComponent[] = [];

      if (baseComponents && baseComponents.length > 0) {
          const ingredientIds = [...new Set(baseComponents.map(c => c.ingredient_id).filter(id => id != null))] as string[];
          const unitIds = [...new Set(baseComponents.map(c => c.unit_id).filter(id => id != null))] as string[];

          const servingUnitId = (dishData.serving_unit as DbUnit | null)?.unit_id;
          if (servingUnitId && !unitIds.includes(servingUnitId)) unitIds.push(servingUnitId);

          const { data: ingredientDetails, error: ingredientError } = await supabase
            .from('ingredients')
            .select('*, base_unit:ingredients_unit_id_fkey(*)')
            .in('ingredient_id', ingredientIds) as { data: FetchedIngredientDetail[] | null, error: any };
          if (ingredientError) throw ingredientError;
          const typedIngredientDetails = ingredientDetails as FetchedIngredientDetail[] | null;
          typedIngredientDetails?.forEach(ing => {
              const baseUnitId = (ing.base_unit as DbUnit | null)?.unit_id;
              if (baseUnitId && !unitIds.includes(baseUnitId)) unitIds.push(baseUnitId);
          });

          const { data: preparationDetails, error: prepError } = await supabase
            .from('preparations')
            .select('*, yield_unit:preparations_amount_unit_id_fkey(*)')
            .in('preparation_id', ingredientIds) as { data: FetchedPreparationDetail[] | null, error: any };
          if (prepError) throw prepError;
          const typedPreparationDetails = preparationDetails as FetchedPreparationDetail[] | null;
          typedPreparationDetails?.forEach(prep => {
            const yieldUnitId = (prep.yield_unit as DbUnit | null)?.unit_id;
            if (yieldUnitId && !unitIds.includes(yieldUnitId)) unitIds.push(yieldUnitId);
          });

          const preparationIds = typedPreparationDetails?.map(p => p.preparation_id) || [];
          let prepIngredientsData: FetchedPreparationIngredient[] = [];
          if (preparationIds.length > 0) {
            const { data: fetchedPrepIngredients, error: prepIngError } = await supabase
              .from('preparation_ingredients')
              .select('*, unit:preparation_ingredients_unit_id_fkey(*), ingredient:preparation_ingredients_ingredient_id_fkey(*)')
              .in('preparation_id', preparationIds) as { data: FetchedPreparationIngredient[] | null, error: any };
            if (prepIngError) throw prepIngError;
            prepIngredientsData = (fetchedPrepIngredients as FetchedPreparationIngredient[] | null) || [];
            prepIngredientsData.forEach(pi => {
              const unitId = (pi.unit as DbUnit | null)?.unit_id;
              if (unitId && !unitIds.includes(unitId)) unitIds.push(unitId);
            });
          }

          const uniqueUnitIds = [...new Set(unitIds)];
          let unitsMap = new Map<string, DbUnit>();
          if (uniqueUnitIds.length > 0) {
              const { data: unitDetails, error: unitError } = await supabase
                .from('units')
                .select('*')
                .in('unit_id', uniqueUnitIds) as { data: DbUnit[] | null, error: any };
              if (unitError) throw unitError;
              unitsMap = new Map(unitDetails?.map(unit => [unit.unit_id, unit]));
          }

          const ingredientsMap = new Map(typedIngredientDetails?.map(ing => [ing.ingredient_id, ing]));
          const preparationsMap = new Map(typedPreparationDetails?.map(prep => [prep.preparation_id, prep]));

          const prepIngredientsMap = new Map<string, PreparationIngredient[]>();
          prepIngredientsData.forEach(pi => {
              const transformedPi = transformPreparationIngredient(pi);
              if (!prepIngredientsMap.has(pi.preparation_id)) {
                  prepIngredientsMap.set(pi.preparation_id, []);
              }
              prepIngredientsMap.get(pi.preparation_id)?.push(transformedPi);
          });

          finalComponents = baseComponents.map(baseComp => {
            const ingredient = ingredientsMap.get(baseComp.ingredient_id);
            const preparation = preparationsMap.get(baseComp.ingredient_id);
            const componentUnit = baseComp.unit_id ? unitsMap.get(baseComp.unit_id) : undefined;

            const assembledData: AssembledComponentData = {
                dish_id: dish?.dish_id || dishId || '', // Add fallback to dishId or empty string if dish is null
                baseComponent: baseComp,
                ingredient: ingredient,
                preparation: preparation,
                componentUnit: componentUnit,
                prepIngredients: preparation ? prepIngredientsMap.get(preparation.preparation_id) : undefined
            };
            return transformDishComponent(assembledData);
          });
      }

      const transformedDish = transformDish(dishData as FetchedDishData);
      const finalDish: DishWithDetails = {
        ...transformedDish,
        serving_unit: dishData ? transformUnit(dishData.serving_unit as DbUnit | null) : null, // Revert to null check
        components: finalComponents,
      };

      setDish(finalDish);

      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      console.error('Error fetching dish details:', err);
      setDish(null);
      } finally {
        setLoading(false);
      }
      // Dependency array can now correctly reference kitchenId from the outer scope
  }, [dishId, kitchenId]);

  useEffect(() => {
    refresh();
  }, [refresh]); // refresh dependency array already includes dishId and kitchenId

  return { dish, loading, error, refresh };
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
    // kitchenId is now available from the outer scope
    async function fetchMenuSections() {
      if (!kitchenId) {
        setError(new Error("Kitchen ID not available. Cannot fetch menu sections."));
        setLoading(false);
        setMenuSections([]);
        return;
      }

      try {
        setLoading(true);
        setError(null); // Reset error on new fetch

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
    // Dependency array can now correctly reference kitchenId from the outer scope
  }, [refreshTrigger, kitchenId]);

  return { menuSections, loading, error, refresh };
}

/**
 * Hook to fetch a single preparation with its details and ingredients
 */
// NOTE: This hook might need kitchen_id filtering if preparations aren't globally unique
// or if access should be restricted per kitchen. For now, assuming preparationId is globally unique
// or RLS handles access based on related dishes/ingredients.
export function usePreparationDetail(preparationId: string | undefined) {
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [ingredients, setIngredients] = useState<PreparationComponentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    async function fetchPreparationDetails() {
      if (!preparationId) {
        setLoading(false);
        return;
      }

      // Reset state
      setLoading(true);
      setError(null);
      setPreparation(null);
      setIngredients([]);

      try {
        // 1. Fetch the base ingredient details for the main preparation ID
        const { data: mainIngredientData, error: mainIngredientError } = await supabase
            .from('ingredients')
            .select('ingredient_id, name, cooking_notes, storage_location, unit_id, amount, base_unit:ingredients_unit_id_fkey(*)') // Fetch base_unit too
            .eq('ingredient_id', preparationId)
            .maybeSingle(); // Use maybeSingle in case it's only in preparations table

        if (mainIngredientError) throw mainIngredientError;
        // Ingredient data might be null if it's a preparation created without a base ingredient row first

        // 2. Fetch the main preparation details (yield amount comes from mainIngredientData)
        // Note: We're selecting reference_ingredient, even if it might not exist in older databases
        const { data: prepData, error: prepError } = await supabase
          .from('preparations')
          .select(`
            preparation_id,
            directions,
            total_time,
            yield_unit:units!preparations_amount_unit_id_fkey ( * )
          `)
          .eq('preparation_id', preparationId)
          .single(); // Preparation MUST exist

        if (prepError) throw prepError; // Throw error if main preparation doesn't exist
        if (!prepData) throw new Error('Preparation core data not found');

        // Try to fetch reference_ingredient separately to handle potential schema differences
        let referenceIngredient = null;
        try {
          const { data: refIngData } = await supabase
            .from('preparations')
            .select('reference_ingredient')
            .eq('preparation_id', preparationId)
            .single();
          
          if (refIngData) {
            referenceIngredient = refIngData.reference_ingredient;
          }
        } catch (refIngErr) {
          console.warn('Could not fetch reference_ingredient, may not be in schema yet:', refIngErr);
        }

        // 3. Fetch the ingredients used *in* this preparation
        const { data: prepIngredientsData, error: prepIngredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            preparation_id,
            ingredient_id,
            amount,
            unit:units!preparation_ingredients_unit_id_fkey(*),
            ingredient:ingredients!preparation_ingredients_ingredient_id_fkey (
              ingredient_id,
              name,
              cooking_notes
            )
          `)
          .eq('preparation_id', preparationId) as { data: FetchedPreparationIngredient[] | null, error: any };

        if (prepIngredientsError) throw prepIngredientsError;

        let finalIngredients: PreparationComponentDetail[] = [];

        if (prepIngredientsData && prepIngredientsData.length > 0) {
          const ingredientIds = prepIngredientsData.map(pi => pi.ingredient_id);
          const potentialNestedPrepIds = ingredientIds; // Keep track of IDs that *could* be preparations

          // 4a. Fetch basic details for potential nested preparations
          // Basic nested preparations query that will work on all schemas
          const { data: nestedPrepBaseData, error: nestedPrepError1 } = await supabase
            .from('preparations') // Still query preparations table
            .select(`
              preparation_id,
              total_time,
              amount_unit_id
            `)
            .in('preparation_id', potentialNestedPrepIds);

          if (nestedPrepError1) {
            console.warn("Error fetching nested preparation base details:", nestedPrepError1);
            // Decide how to handle this - maybe proceed without nested details?
          }

          // Try to fetch nested preparations' reference_ingredient
          let nestedPrepRefIngredients = new Map<string, string | null>();
          try {
            const { data: nestedRefIngData } = await supabase
              .from('preparations')
              .select('preparation_id, reference_ingredient')
              .in('preparation_id', potentialNestedPrepIds);
            
            if (nestedRefIngData) {
              nestedPrepRefIngredients = new Map(
                nestedRefIngData.map(item => [item.preparation_id, item.reference_ingredient])
              );
            }
          } catch (nestedRefIngError) {
            console.warn('Could not fetch nested reference_ingredient, may not be in schema yet:', nestedRefIngError);
          }

          // 4b. Fetch yield amounts for these preparations from the ingredients table
          const actualNestedPrepIds = nestedPrepBaseData?.map(p => p.preparation_id) || [];
          const { data: nestedPrepYieldData, error: nestedPrepError2 } = await supabase
            .from('ingredients')
            .select(`ingredient_id, amount`)
            .in('ingredient_id', actualNestedPrepIds);

          if (nestedPrepError2) {
            console.warn("Error fetching nested preparation yield amounts:", nestedPrepError2);
          }

          // Combine the fetched data
          const nestedPrepDetailsMap = new Map(nestedPrepBaseData?.map(p => {
            const yieldInfo = nestedPrepYieldData?.find(y => y.ingredient_id === p.preparation_id);
            return [p.preparation_id, { 
              ...p, 
              yield_amount: yieldInfo?.amount ?? null,
              reference_ingredient: nestedPrepRefIngredients.get(p.preparation_id) || null 
            }];
          }));

          // --- Fetch ingredients FOR the nested preparations ---
          let nestedPrepIngredientsMap = new Map<string, PreparationIngredient[]>();

          if (actualNestedPrepIds.length > 0) {
            const { data: nestedIngredientsData, error: nestedIngError } = await supabase
              .from('preparation_ingredients')
              .select(`
                preparation_id,
                amount,
                unit:units!preparation_ingredients_unit_id_fkey(*),
                ingredient:ingredients!preparation_ingredients_ingredient_id_fkey (ingredient_id, name)
              `)
              .in('preparation_id', actualNestedPrepIds) as { data: FetchedPreparationIngredient[] | null, error: any };

            if (nestedIngError) {
              console.warn("Error fetching ingredients for nested preparations:", nestedIngError);
            } else if (nestedIngredientsData) {
              nestedIngredientsData.forEach(nestedIng => {
                const transformedIng = transformPreparationIngredient(nestedIng);
                if (!nestedPrepIngredientsMap.has(nestedIng.preparation_id)) {
                  nestedPrepIngredientsMap.set(nestedIng.preparation_id, []);
                }
                nestedPrepIngredientsMap.get(nestedIng.preparation_id)?.push(transformedIng);
              });
            }
          }

          // --- Fetch Units for nested prep yield units --- 
          // Fetch units based on the IDs we just fetched
          const nestedPrepUnitIds = nestedPrepBaseData?.map(p => p.amount_unit_id).filter(id => id) as string[] || [];
          let nestedUnitsMap = new Map<string, DbUnit>();
          if (nestedPrepUnitIds.length > 0) {
            const { data: nestedPrepUnits, error: nestedUnitsError } = await supabase
              .from('units')
              .select('*')
              .in('unit_id', nestedPrepUnitIds);

            if (nestedUnitsError) console.warn("Error fetching units for nested prep yields:", nestedUnitsError);
            else nestedUnitsMap = new Map(nestedPrepUnits?.map(u => [u.unit_id, u]));
          }

          // Create map for faster lookup of nested prep core details
          const nestedPreparationsMap = nestedPrepDetailsMap; // Use the combined map
          // ----------------------------------------------------

          // 5. Transform the ingredients list
          finalIngredients = prepIngredientsData.map((pi): PreparationComponentDetail => {
            const ingredientInfo = pi.ingredient as FetchedIngredientDetail | null; // Base ingredient details
            const nestedPrepInfo = nestedPreparationsMap.get(pi.ingredient_id);
            const unitInfo = pi.unit as DbUnit | null;

            if (!ingredientInfo) {
              // Handle case where ingredient data might be missing (shouldn't happen with current query)
              console.warn(`Missing base ingredient data for ID: ${pi.ingredient_id} in preparation ${pi.preparation_id}`);
              return {
                isPreparation: false,
                id: pi.ingredient_id,
                name: 'Unknown Ingredient',
                amount: pi.amount,
                unit: transformUnit(unitInfo),
                rawIngredientDetails: null,
                preparationDetails: null,
              };
            }

            const isNestedPrep = !!nestedPrepInfo;

            return {
              isPreparation: isNestedPrep,
              id: ingredientInfo.ingredient_id,
              name: ingredientInfo.name,
              amount: pi.amount, // This is the amount used *in* the parent prep
              unit: transformUnit(unitInfo),
              preparationDetails: isNestedPrep ? {
                total_time: nestedPrepInfo.total_time,
                yield_amount: nestedPrepInfo.yield_amount, // Use amount from combined map
                yield_unit: transformUnit(nestedUnitsMap.get(nestedPrepInfo.amount_unit_id) as DbUnit | null), // Use fetched unit via ID
                ingredients: nestedPrepIngredientsMap.get(nestedPrepInfo.preparation_id) || [],
                reference_ingredient: nestedPrepInfo.reference_ingredient
              } : null,
              rawIngredientDetails: !isNestedPrep ? {
                cooking_notes: ingredientInfo.cooking_notes,
              } : null,
            };
          });
        }

        // 6. Assemble the main preparation object
        const mainPrepName = mainIngredientData?.name || prepData.preparation_id; // Fallback name
        const transformedPreparation: Preparation = {
          preparation_id: prepData.preparation_id,
          name: mainPrepName,
          directions: prepData.directions,
          total_time: prepData.total_time,
          yield_unit: transformUnit(Array.isArray(prepData.yield_unit) ? prepData.yield_unit[0] : prepData.yield_unit as DbUnit | null),
          yield_amount: mainIngredientData?.amount ?? null,
          reference_ingredient: referenceIngredient,
          ingredients: [], // This is now handled by the separate 'ingredients' state
          cooking_notes: mainIngredientData?.cooking_notes || null, // Notes from base ingredient if available
        };

        setPreparation(transformedPreparation);
        setIngredients(finalIngredients);

      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching preparation details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPreparationDetails();
  }, [preparationId, kitchenId]);

  return { preparation, ingredients, loading, error };
}

/**
 * Hook to search dishes within the current kitchen
 */
export function useDishSearch(searchQuery: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    // kitchenId is now available from the outer scope
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
    // Dependency array can now correctly reference kitchenId from the outer scope
  }, [searchQuery, kitchenId]); // Re-run if search query or kitchenId changes

  return { results, loading, error };
}

/**
 * Hook to fetch all preparations for the current kitchen.
 * Fetches ingredients that have a corresponding entry in the preparations table.
 */
// NOTE: This assumes 'ingredients' table also has 'kitchen_id'. Needs verification.
export function usePreparations() {
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    // kitchenId is now available from the outer scope
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
    // Dependency array can now correctly reference kitchenId from the outer scope
  }, [kitchenId]); // Run once on mount or when kitchenId changes

  return { preparations, loading, error };
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
// NOTE: This assumes 'ingredients' table has 'kitchen_id'. Needs verification.
export function useIngredients(identifyPreparations: boolean = false) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Define kitchenId using the new hook
  const kitchenId = useCurrentKitchenId();

  useEffect(() => {
    // kitchenId is now available from the outer scope
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
    // Dependency array can now correctly reference kitchenId from the outer scope
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