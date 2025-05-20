import { supabase } from '../data/supabaseClient';
import { queryClient } from '../data/queryClient';
import { 
  FetchedDishData, 
  transformDish, 
  transformDishComponent, 
  transformPreparation, 
  transformUnit,
  DbDishComponent, 
  DbUnit, 
  AssembledComponentData, 
  FetchedBaseComponent, 
  FetchedIngredientDetail, 
  FetchedPreparationDetail, 
  FetchedPreparationDataCombined,
  FetchedPreparationIngredient, 
} from '../utils/transforms';
import { Preparation } from '../types';
import { appLogger } from './AppLogService';

/**
 * Service to prefetch recipe data on app startup
 */
class DataPrefetchService {
  // Keep track of prefetching status
  private prefetchingInProgress = false;
  private prefetchCompleted = false;
  
  /**
   * Prefetches dishes and preparations for the current kitchen
   * @param kitchenId The ID of the user's kitchen
   */
  async prefetchAllRecipeData(kitchenId: string | null): Promise<void> {
    if (!kitchenId) {
      appLogger.warn('[DataPrefetchService] Cannot prefetch: No kitchen ID available');
      return;
    }
    
    if (this.prefetchingInProgress) {
      appLogger.log('[DataPrefetchService] Prefetch already in progress, skipping');
      return;
    }
    
    if (this.prefetchCompleted) {
      appLogger.log('[DataPrefetchService] Prefetch already completed, skipping');
      return;
    }
    
    this.prefetchingInProgress = true;
    appLogger.log('[DataPrefetchService] Starting data prefetch...');
    
    try {
      // 1. Prefetch all dishes
      await this.prefetchDishes(kitchenId);
      
      // 2. Prefetch all preparations
      await this.prefetchPreparations(kitchenId);
      
      // 3. Prefetch menu sections
      await this.prefetchMenuSections(kitchenId);
      
      // 4. Prefetch all ingredients (including preparations)
      await this.prefetchIngredients(kitchenId);
      
      this.prefetchCompleted = true;
      appLogger.log('[DataPrefetchService] Data prefetch completed successfully');
    } catch (error) {
      appLogger.error('[DataPrefetchService] Error during prefetch:', error);
    } finally {
      this.prefetchingInProgress = false;
    }
  }
  
  /**
   * Prefetch all dishes for a kitchen
   */
  private async prefetchDishes(kitchenId: string): Promise<void> {
    appLogger.log('[DataPrefetchService] Prefetching dishes...');
    
    // Define the function to fetch dishes (similar to useDishes)
    const fetchDishes = async () => {
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

        // console.log('[DataPrefetchService] fetchDishes', fetchDishes);

      const { data: dishesData, error: dishesError } = await query.order('dish_name') as { 
        data: FetchedDishData[] | null, 
        error: any 
      };

       console.log("[Prefetch] dishesData after fetch:", dishesData);

      if (dishesError) throw dishesError;
      if (!dishesData) return [];

      // Fetch and include components for each dish
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
          .eq('dish_id', dish.dish_id) as { 
            data: (DbDishComponent & { 
              unit: DbUnit | null, 
              ingredient: (FetchedIngredientDetail & { preparation: FetchedPreparationDetail | null }) | null 
            })[] | null, 
            error: any 
          };

        if (componentsError) {
          appLogger.error(`Error fetching components for dish ${dish.dish_id}:`, componentsError);
          return { ...transformDish(dish as FetchedDishData), components: [] };
        }

        const typedComponents = dishComponents;
        const transformedComponents = typedComponents ? typedComponents.map(comp => {
          const ingredientData = comp.ingredient as (FetchedIngredientDetail & { preparation: FetchedPreparationDetail & { ingredients?: any[] } | null }) | null;
          // Transform nested preparation ingredients if they exist (match useDishDetail logic)
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
            prepIngredients: transformedPrepIngredients
          };
          return transformDishComponent(assembledData);
        }) : [];

        // Also prefetch individual dish details
        // This sets the detail data in the query cache
        const dishDetail = { ...transformDish(dish as FetchedDishData), components: transformedComponents };

      console.log(`[Prefetch] Caching dish detail for ${dish.dish_id}`);
      console.log(`[Prefetch] dishDetail object reference:`, dishDetail);
      console.log(`[Prefetch] dishDetail.components reference:`, dishDetail.components);

        await queryClient.prefetchQuery({
          queryKey: ['dish', { dish_id: dish.dish_id }],
          queryFn: () => Promise.resolve(dishDetail)
        });

        return dishDetail;
      }));

      return dishesWithComponents || [];
    };

    // Prefetch the data using the queryClient directly
    await queryClient.prefetchQuery({
      queryKey: ['dishes', { kitchen_id: kitchenId }],
      queryFn: fetchDishes
    });
    
    appLogger.log('[DataPrefetchService] Dishes prefetch completed');
  }
  
  /**
   * Prefetch all preparations for a kitchen
   */
  private async prefetchPreparations(kitchenId: string): Promise<void> {
    appLogger.log('[DataPrefetchService] Prefetching preparations...');
    
    // Fetch all preparations
    const fetchPreparations = async () => {
      // Fetch preparations linked to ingredients for the kitchen
      const { data: prepJoinData, error: preparationsError } = await supabase
        .from('preparations')
        .select(`
          *,
          yield_unit:units (*),
          ingredient:ingredients!preparations_preparation_id_fkey (
            *,
            base_unit:ingredients_unit_id_fkey(*)
          )
        `)
        .eq('ingredient.kitchen_id', kitchenId)
        .order('ingredient.name') as { 
          data: ({ 
            // Define structure based on select, including all fields from preparations and the joined ingredient
            preparation_id: string;
            directions: string | null;
            total_time: number | null;
            reference_ingredient: string | null;
            yield_unit: DbUnit | null;
            amount_unit_id: string | null;
            fingerprint: string | null;
            // Assume ingredient includes all fields from FetchedIngredientDetail plus amount
            ingredient: (FetchedIngredientDetail & { amount: number, kitchen_id: string | null }); 
          })[] | null, 
          error: any 
        };

      if (preparationsError) throw preparationsError;
      if (!prepJoinData) return [];

      // Fetch ingredients for each preparation and prefetch details
      const preparationsWithDetails = await Promise.all(prepJoinData.map(async (prepJoinItem) => {
        // Check if ingredient data is present (it should be based on query type)
        if (!prepJoinItem.ingredient) {
          appLogger.warn(`Skipping prefetch for preparation ${prepJoinItem.preparation_id} due to missing ingredient link.`);
          return null; // Skip this preparation
        }

        const preparationId = prepJoinItem.preparation_id;
        
        // Construct the combined data object for transformation
        const combinedDataForTransform: FetchedPreparationDataCombined = {
            // Fields from FetchedIngredientDetail
            ingredient_id: prepJoinItem.ingredient.ingredient_id,
            name: prepJoinItem.ingredient.name,
            cooking_notes: prepJoinItem.ingredient.cooking_notes,
            storage_location: prepJoinItem.ingredient.storage_location,
            unit_id: prepJoinItem.ingredient.unit_id,
            base_unit: prepJoinItem.ingredient.base_unit,
            deleted: prepJoinItem.ingredient.deleted,
            kitchen_id: prepJoinItem.ingredient.kitchen_id ?? '',
            synonyms: prepJoinItem.ingredient.synonyms,
            // Fields from FetchedPreparationDetail (via prepJoinItem directly)
            preparation_id: prepJoinItem.preparation_id,
            directions: prepJoinItem.directions ?? '', // Provide default empty string for null
            total_time: prepJoinItem.total_time,
            yield_unit: prepJoinItem.yield_unit,
            amount_unit_id: prepJoinItem.amount_unit_id,
            fingerprint: prepJoinItem.fingerprint,
            // Fields explicitly required by FetchedPreparationDataCombined
            amount: prepJoinItem.ingredient.amount ?? 0, // Ensure amount is number
            created_at: prepJoinItem.ingredient.created_at ?? null, // Handle null
            updated_at: prepJoinItem.ingredient.updated_at ?? null, // Handle null
        };

        // Transform preparation base details
        const transformedPrepBase = transformPreparation(combinedDataForTransform);

        // Fetch sub-ingredients for this preparation
        const { data: ingredientsData, error: ingredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            *,
            unit:units (*),
            ingredient:ingredients (name, ingredient_id)
          `)
          .eq('preparation_id', preparationId) as { data: (FetchedPreparationIngredient & { unit: DbUnit | null, ingredient: { name: string, ingredient_id: string } | null })[] | null, error: any }; // Use FetchedPreparationIngredient

        if (ingredientsError) {
          appLogger.error(`Error fetching ingredients for preparation ${preparationId}:`, ingredientsError);
          // Assign empty array if sub-ingredients fetch fails
          transformedPrepBase.ingredients = [];
        } else {
          // Transform sub-ingredients
          transformedPrepBase.ingredients = (ingredientsData || []).map(ing => ({
            preparation_id: ing.preparation_id || '', // Ensure preparation_id is a string
            ingredient_id: ing.ingredient?.ingredient_id || '', // Ensure ingredient_id is a string
            name: ing.ingredient?.name || 'Unknown Ingredient', // Extract name safely
            amount: ing.amount ?? 0,
            unit: transformUnit(ing.unit)
          }));
        }

        // Prefetch individual preparation details
        await queryClient.prefetchQuery({
          queryKey: ['preparation', { preparation_id: preparationId }],
          queryFn: () => Promise.resolve({ 
            preparation: transformedPrepBase, 
            ingredients: transformedPrepBase.ingredients || [],
            loading: false,
            error: null 
          })
        });

        return transformedPrepBase;
      }));

      // Filter out any null results from skipped preparations
      return preparationsWithDetails.filter(p => p !== null) as Preparation[]; 
    };

    // Prefetch the overall list of preparations
    await queryClient.prefetchQuery({
      queryKey: ['preparations', { kitchen_id: kitchenId }],
      queryFn: fetchPreparations
    });
    
    appLogger.log('[DataPrefetchService] Preparations prefetch completed');
  }
  
  /**
   * Prefetch menu sections for a kitchen
   */
  private async prefetchMenuSections(kitchenId: string): Promise<void> {
    appLogger.log('[DataPrefetchService] Prefetching menu sections...');
    
    const fetchMenuSections = async () => {
      const { data, error } = await supabase
        .from('menu_section')
        .select('*')
        .eq('kitchen_id', kitchenId)
        .order('display_order');

      if (error) throw error;
      return data || [];
    };

    await queryClient.prefetchQuery({
      queryKey: ['menuSections', { kitchen_id: kitchenId }],
      queryFn: fetchMenuSections
    });
    
    appLogger.log('[DataPrefetchService] Menu sections prefetch completed');
  }
  
  /**
   * Prefetch all ingredients (including preparations)
   */
  private async prefetchIngredients(kitchenId: string): Promise<void> {
    appLogger.log('[DataPrefetchService] Prefetching ingredients...');
    
    const fetchIngredients = async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          ingredient_id,
          name,
          cooking_notes,
          unit_id,
          unit:ingredients_unit_id_fkey (*)
        `)
        .order('name');

      if (error) throw error;
      return data || [];
    };

    await queryClient.prefetchQuery({
      queryKey: ['ingredients'],
      queryFn: fetchIngredients
    });
    
    appLogger.log('[DataPrefetchService] Ingredients prefetch completed');
  }
  
  /**
   * Clear prefetch status to allow prefetching again if needed
   */
  clearPrefetchStatus(): void {
    this.prefetchCompleted = false;
  }
  
  /**
   * Check if prefetch is completed
   */
  isPrefetchCompleted(): boolean {
    return this.prefetchCompleted;
  }
}

// Export a singleton instance
export const dataPrefetchService = new DataPrefetchService();