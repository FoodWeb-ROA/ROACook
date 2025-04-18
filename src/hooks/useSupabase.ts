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
            total_yield,
            directions,
            menu_section:dishes_menu_section_id_fkey (*),
            serving_unit:dishes_serving_unit_id_fkey (*)
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
              unit:dish_components_unit_id_fkey(*),
              ingredient:dish_components_ingredient_id_fkey (
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
export function useDishDetail(dishId: string | undefined) {
  const [dish, setDish] = useState<Dish | null>(null);
  const [components, setComponents] = useState<DishComponent[]>([]);
  const [menuSection, setMenuSection] = useState<MenuSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDishDetails = useCallback(async () => {
    if (!dishId) {
      setLoading(false);
      setDish(null);
      setComponents([]);
      setMenuSection(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: dishData, error: dishError } = await supabase
        .from('dishes')
        .select(`
          *,
          menu_section:dishes_menu_section_id_fkey (*),
          serving_unit:dishes_serving_unit_id_fkey (*)
        `)
        .eq('dish_id', dishId)
        .single() as { data: FetchedDishData | null, error: any };

      if (dishError) throw dishError;
      if (!dishData) throw new Error('Dish not found');

      const { data: baseComponents, error: baseCompError } = await supabase
        .from('dish_components')
        .select('ingredient_id, unit_id, amount')
        .eq('dish_id', dishId) as { data: FetchedBaseComponent[] | null, error: any };

      if (baseCompError) throw baseCompError;
      if (!baseComponents || baseComponents.length === 0) {
        setDish(transformDish(dishData as FetchedDishData));
        setMenuSection(transformMenuSection(dishData.menu_section as DbMenuSection | null));
        setComponents([]);
        setLoading(false);
        return;
      }

      const ingredientIds = [...new Set(baseComponents.map(c => c.ingredient_id).filter(id => id != null))] as string[];
      const unitIds = [...new Set(baseComponents.map(c => c.unit_id).filter(id => id != null))] as string[];
      if (dishData.serving_unit?.unit_id) unitIds.push(dishData.serving_unit.unit_id);
      const uniqueUnitIds = [...new Set(unitIds)];

      const { data: ingredientDetails, error: ingredientError } = await supabase
        .from('ingredients')
        .select('*, base_unit:ingredients_unit_id_fkey(*)')
        .in('ingredient_id', ingredientIds) as { data: FetchedIngredientDetail[] | null, error: any };
      if (ingredientError) throw ingredientError;
      const typedIngredientDetails = ingredientDetails as FetchedIngredientDetail[] | null;
      typedIngredientDetails?.forEach(ing => {
        const baseUnitId = (ing.base_unit as DbUnit | null)?.unit_id;
        if (baseUnitId && !uniqueUnitIds.includes(baseUnitId)) {
            uniqueUnitIds.push(baseUnitId);
        }
      });

      const { data: preparationDetails, error: prepError } = await supabase
        .from('preparations')
        .select('*, yield_unit:preparations_yield_unit_id_fkey(*)')
        .in('preparation_id', ingredientIds) as { data: FetchedPreparationDetail[] | null, error: any };
      if (prepError) throw prepError;
      const typedPreparationDetails = preparationDetails as FetchedPreparationDetail[] | null;
      typedPreparationDetails?.forEach(prep => {
        const yieldUnitId = (prep.yield_unit as DbUnit | null)?.unit_id;
        if (yieldUnitId && !uniqueUnitIds.includes(yieldUnitId)) {
            uniqueUnitIds.push(yieldUnitId);
        }
      });

      const { data: unitDetails, error: unitError } = await supabase
        .from('units')
        .select('*')
        .in('unit_id', uniqueUnitIds) as { data: DbUnit[] | null, error: any };
      if (unitError) throw unitError;
      const typedUnitDetails = unitDetails as DbUnit[] | null;

      const preparationIds = preparationDetails?.map(p => p.preparation_id) || [];
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
          if (unitId && !uniqueUnitIds.includes(unitId)) uniqueUnitIds.push(unitId);
        });
      }

      const ingredientsMap = new Map(typedIngredientDetails?.map(ing => [ing.ingredient_id, ing]));
      const preparationsMap = new Map(typedPreparationDetails?.map(prep => [prep.preparation_id, prep]));
      const unitsMap = new Map(typedUnitDetails?.map(unit => [unit.unit_id, unit]));
      const prepIngredientsMap = new Map<string, PreparationIngredient[]>();
      prepIngredientsData.forEach(pi => {
        prepIngredientsMap.get(pi.preparation_id)?.push(transformPreparationIngredient(pi));
      });

      const finalComponents: DishComponent[] = baseComponents.map(baseComp => {
        const ingredient = ingredientsMap.get(baseComp.ingredient_id);
        const preparation = preparationsMap.get(baseComp.ingredient_id);
        const componentUnit = baseComp.unit_id ? unitsMap.get(baseComp.unit_id) : undefined;
        const isPreparation = !!preparation;

        let finalPrepDetails = null;
        if (isPreparation && preparation && ingredient) {
            const prepInput = { ...ingredient, ...preparation } as (FetchedIngredientDetail & FetchedPreparationDetail);
            finalPrepDetails = transformPreparation(prepInput);
            finalPrepDetails.ingredients = prepIngredientsMap.get(preparation.preparation_id) || [];
        }
        
        const finalRawIngredientDetails = !isPreparation && ingredient ? {
            ...transformIngredient(ingredient),
            base_unit: transformUnit(ingredient.base_unit)
        } : null;

        const assembledData: AssembledComponentData = {
            dish_id: dishId!, 
            baseComponent: baseComp,
            ingredient: ingredient,
            preparation: preparation,
            componentUnit: componentUnit,
            prepIngredients: isPreparation ? prepIngredientsMap.get(baseComp.ingredient_id) : undefined
        };

        return transformDishComponent(assembledData);
      });

      const finalDishData = dishData as FetchedDishData;
      setDish(transformDish(finalDishData));
      setMenuSection(transformMenuSection(finalDishData.menu_section));
      setComponents(finalComponents);

    } catch (err) {
      console.error('Error fetching dish details (refactored):', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setDish(null);
      setComponents([]);
      setMenuSection(null);
    } finally {
      setLoading(false);
    }
  }, [dishId]);

  useEffect(() => {
    fetchDishDetails();
  }, [fetchDishDetails]);

  return { dish, components, menuSection, loading, error, refetch: fetchDishDetails };
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
            .select('ingredient_id, name, cooking_notes, storage_location, unit_id')
            .eq('ingredient_id', preparationId)
            .single();

        if (ingredientError) throw ingredientError;
        if (!ingredientData) throw new Error('Preparation base ingredient not found');

        const { data: prepData, error: prepError } = await supabase
          .from('preparations')
          .select(`
            directions,
            total_time,
            yield_unit:units!preparations_yield_unit_id_fkey ( * ) /* Hint FK */
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
            unit:units!preparation_ingredients_unit_id_fkey(*), /* Hint FK */
            ingredient:ingredients!preparation_ingredients_ingredient_id_fkey ( /* Hint FK */
                ingredient_id,
                name
                /* Add cooking_notes etc. from ingredient if needed by PreparationIngredient UI type */
            )
          `)
          .eq('preparation_id', preparationId) as { data: FetchedPreparationIngredient[] | null, error: any };

        if (prepIngredientsError) throw prepIngredientsError;

        const transformedIngredients = prepIngredientsData ? prepIngredientsData.map(pi => transformPreparationIngredient(pi as FetchedPreparationIngredient)) : [];

        const typedIngredientData = ingredientData as FetchedIngredientDetail | null;
        const typedPrepData = prepData as FetchedPreparationDetail | null;

        const combinedPreparationData = typedPrepData && typedIngredientData ? {
            ...typedIngredientData,
            ...typedPrepData 
        } : (typedIngredientData ? {
            ...typedIngredientData,
            preparation_id: typedIngredientData.ingredient_id,
            directions: null,
            total_time: null,
            yield_unit_id: null,
            yield_unit: null,
        } : null);

        setPreparation(combinedPreparationData ? transformPreparation(combinedPreparationData as (FetchedIngredientDetail & FetchedPreparationDetail)) : null);
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