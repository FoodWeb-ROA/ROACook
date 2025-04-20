import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../data/supabaseClient';
import { Dish, DishComponent, Ingredient, Unit, MenuSection, Preparation, PreparationIngredient } from '../types';
import { transformDish, transformDishComponent, transformPreparation, transformMenuSection, transformPreparationIngredient, transformUnit, transformIngredient, FetchedDishData, DbMenuSection, FetchedBaseComponent, FetchedIngredientDetail, FetchedPreparationDetail, FetchedPreparationIngredient, AssembledComponentData, DbDishComponent, DbUnit } from '../utils/transforms';



/**
 * Hook to fetch all dishes with optional filter by menu section
 */
export function useDishes(menuSectionId?: string) {
  const [dishes, setDishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchDishes() {
      try {
        setLoading(true);
        
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
          `);
        
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
                prepIngredients: undefined 
            };
            return transformDishComponent(assembledData);
          }) : [];
          
          return { ...transformDish(dish as FetchedDishData), components: transformedComponents };
        }));
        
        setDishes(dishesWithComponents || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching dishes:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDishes();
  }, [menuSectionId]);

  return { dishes, loading, error };
}

/**
 * Hook to fetch a single dish with all its related data (Refactored Strategy)
 */
export type DishWithDetails = Dish & {
    serving_unit?: Unit | null;
    components: DishComponent[];
};

export function useDishDetail(dishId: string | undefined) {
  const [dish, setDish] = useState<DishWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!dishId) {
        setLoading(false);
      setDish(null);
      setError(null);
        return;
      }

        setLoading(true);
    setError(null);
    setDish(null);

    try {
      const { data: dishData, error: dishError } = await supabase
        .from('dishes')
          .select(`
            *,
            menu_section:menu_section_id(*),
            serving_unit:units!dishes_serving_unit_fkey(*),
            serving_item
          `)
        .eq('dish_id', dishId)
        .single() as { data: FetchedDishData | null, error: any };

      if (dishError) {
        console.error('Error fetching dish details:', dishError);
        throw dishError;
      }
      if (!dishData) throw new Error('Dish not found');

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
                dish_id: dishId!, 
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
        serving_unit: transformUnit(dishData.serving_unit as DbUnit | null),
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
  }, [dishId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { dish, loading, error, refresh };
}

/**
 * Hook to fetch all menu sections (categories)
 */
export function useMenuSections() {
  const [menuSections, setMenuSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    async function fetchMenuSections() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('menu_section')
          .select('menu_section_id, name') 
          .order('name') as { data: DbMenuSection[] | null, error: any };
        
        if (error) throw error;
        
        setMenuSections(data ? data.map(d => transformMenuSection(d as DbMenuSection)) : []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching menu sections:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMenuSections();
  }, [refreshTrigger]);

  return { menuSections, loading, error, refresh };
}

/**
 * Hook to fetch a single preparation with its details and ingredients
 */
export function usePreparationDetail(preparationId: string | undefined) {
  const [preparation, setPreparation] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPreparationDetails() {
      if (!preparationId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        const { data: ingredientData, error: ingredientError } = await supabase
            .from('ingredients')
            .select('ingredient_id, name, cooking_notes, storage_location, unit_id, amount')
            .eq('ingredient_id', preparationId)
            .single();

        if (ingredientError) throw ingredientError;
        if (!ingredientData) throw new Error('Preparation base ingredient not found');

        const { data: prepData, error: prepError } = await supabase
          .from('preparations')
          .select(`
            directions,
            total_time,
            yield_unit:units!preparations_amount_unit_id_fkey ( * )
          `)
          .eq('preparation_id', preparationId)
          .single();
        
         if (prepError && prepError.code !== 'PGRST116') {
             throw prepError;
        }
        
        const { data: prepIngredientsData, error: prepIngredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            amount,
            unit:units!preparation_ingredients_unit_id_fkey(*),
            ingredient:ingredients!preparation_ingredients_ingredient_id_fkey (
              ingredient_id,
              name
            )
          `)
          .eq('preparation_id', preparationId) as { data: FetchedPreparationIngredient[] | null, error: any };

        if (prepIngredientsError) throw prepIngredientsError;

        const transformedIngredients = prepIngredientsData ? prepIngredientsData.map(pi => transformPreparationIngredient(pi as FetchedPreparationIngredient)) : [];

        const typedIngredientData = ingredientData as FetchedIngredientDetail & { amount: number };
        const typedPrepData = prepData as FetchedPreparationDetail | null;

        const combinedPreparationData = {
            ...typedIngredientData,
            ...(typedPrepData || { 
                 preparation_id: typedIngredientData.ingredient_id,
                 directions: null, 
                 total_time: null, 
                 yield_unit_id: null, 
                 yield_unit: null 
            })
        };

        setPreparation(transformPreparation(combinedPreparationData as any));
        setIngredients(transformedIngredients);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching preparation details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPreparationDetails();
  }, [preparationId]);

  return { preparation, ingredients, loading, error };
}

/**
 * Hook to search dishes
 */
export function useDishSearch(searchQuery: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function searchDishes() {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('dishes')
          .select('dish_id, dish_name')
          .ilike('dish_name', `%${searchQuery}%`)
          .order('dish_name');
        
        if (error) throw error;
        
        setResults(data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error searching dishes:', err);
      } finally {
        setLoading(false);
      }
    }

    const debounceTimeout = setTimeout(() => {
      searchDishes();
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  return { results, loading, error };
}

/**
 * Hook to fetch all preparations
 * Fetches ingredients that have a corresponding entry in the preparations table.
 */
export function usePreparations() {
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPreparations() {
      try {
        setLoading(true);

        // Fetch ingredients that are preparations by joining with the preparations table
        // Select necessary fields from both tables
        const { data, error: fetchError } = await supabase
          .from('preparations') // Start from preparations table
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
              base_unit:ingredients_unit_id_fkey(*)
            )
          `)
          .order('ingredient(name)'); // Order by the ingredient name
          
        if (fetchError) throw fetchError;

        // Process the fetched data
        const transformedPreparations = data ? data.map((item: any) => {
            // Combine the ingredient and preparation data for the transformer
            // The structure fetched might differ slightly based on the join direction
            // Adjust based on actual `data` structure log
            // console.log('Fetched prep item:', JSON.stringify(item, null, 2)); 
            
            const ingredientData = item.ingredient as (FetchedIngredientDetail & { amount: number });
            const prepData = { 
                preparation_id: item.preparation_id, 
                directions: item.directions, 
                total_time: item.total_time, 
                yield_unit: item.yield_unit 
            } as FetchedPreparationDetail;
            
            if (!ingredientData) {
                console.warn(`Ingredient data missing for preparation_id: ${item.preparation_id}`);
                return null; // Skip if ingredient data is somehow missing
            }

            const combinedData = { ...ingredientData, ...prepData };
            
            // Assuming transformPreparation expects combined data including amount
            return transformPreparation(combinedData as any); 
        }).filter(p => p !== null) as Preparation[] : []; // Filter out nulls

        setPreparations(transformedPreparations);

      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching preparations:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPreparations();
  }, []); // Run once on mount

  return { preparations, loading, error };
}

/**
 * Hook to fetch all Units
 */
export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUnits() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('units')
          .select('*')
          .order('unit_name');
        
        if (fetchError) throw fetchError;
        
        setUnits(data ? data.map(u => transformUnit(u as DbUnit)) : []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching units:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUnits();
  }, []);

  return { units, loading, error };
}

/**
 * Hook to fetch ingredients, optionally identifying which are preparations.
 */
export function useIngredients(identifyPreparations: boolean = false) {
  // Return type might need adjustment, e.g., Ingredient & { isPreparation: boolean }
  const [ingredients, setIngredients] = useState<Ingredient[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchIngredients() {
      try {
        setLoading(true);
        
        let query = supabase
          .from('ingredients')
          .select('*, base_unit:ingredients_unit_id_fkey(*)');
          
        // If we need to identify preparations, join with the preparations table
        if (identifyPreparations) {
            // Select from ingredients and do a left join check on preparations
            // This requires a more specific select to avoid ambiguity and potentially an RPC call
            // Simpler approach: Fetch all ingredients, fetch all preparation IDs, then mark ingredients.
            
            const { data: ingredientsData, error: ingredientsError } = await supabase
                .from('ingredients')
                .select('*, base_unit:ingredients_unit_id_fkey(*)')
                .order('name') as { data: FetchedIngredientDetail[] | null, error: any };
            
            if (ingredientsError) throw ingredientsError;
            if (!ingredientsData) {
                 setIngredients([]);
                 setLoading(false);
                 return;
            }
                
            const { data: prepIdsData, error: prepIdsError } = await supabase
                .from('preparations')
                .select('preparation_id');
            
            if (prepIdsError) throw prepIdsError;
            
            const preparationIds = new Set(prepIdsData?.map(p => p.preparation_id) || []);
            
            const combinedIngredients = ingredientsData.map(ing => ({
                ...transformIngredient(ing), // Transform base ingredient
                // Add isPreparation flag based on the set of IDs
                isPreparation: preparationIds.has(ing.ingredient_id), 
                // Include base unit details if needed by the consumer (CreateRecipeScreen modal)
                base_unit: transformUnit(ing.base_unit)
            }));
            
            setIngredients(combinedIngredients as Ingredient[]); // Cast needed until Ingredient type includes isPreparation
            
        } else {
            // Fetch only ingredients without checking preparation status
            const { data, error: fetchError } = await query.order('name') as { data: FetchedIngredientDetail[] | null, error: any };
            if (fetchError) throw fetchError;
            setIngredients(data ? data.map(ing => transformIngredient(ing)) : []);
        }

      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching ingredients:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchIngredients();
  }, [identifyPreparations]); // Re-run if the flag changes

  // The returned type should ideally reflect the added `isPreparation` flag
  return { ingredients, loading, error }; 
} 