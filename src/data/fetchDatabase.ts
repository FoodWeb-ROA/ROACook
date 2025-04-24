import { supabase } from './supabaseClient';

export async function fetchAllData() {
  try {
    // Fetch relevant tables data
    const [
      unitsResult,
      ingredientsResult,
      menuSectionResult,
      preparationIngredientsResult,
      preparationsResult,
      dishesResult, 
      dishComponentsResult, 
      // kitchensResult, // Removed
      // kitchenMembersResult, // Removed
    ] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('ingredients').select('*'),
      supabase.from('menu_section').select('*'),
      supabase.from('preparation_ingredients').select('*'),
      supabase.from('preparations').select('*'),
      supabase.from('dishes').select('*'), 
      supabase.from('dish_components').select('*'), 
      // supabase.from('kitchens').select('*'), // Removed
      // supabase.from('kitchen_users').select('*'), // Removed
    ]);

    // Compile results
    const allData = {
      units: unitsResult.data || [],
      ingredients: ingredientsResult.data || [],
      menuSections: menuSectionResult.data || [],
      preparationIngredients: preparationIngredientsResult.data || [],
      preparations: preparationsResult.data || [],
      dishes: dishesResult.data || [], 
      dishComponents: dishComponentsResult.data || [], 
      // Removed kitchens
      // Removed kitchenUsers
    };
    
    // Log errors
    const errors = [
      unitsResult.error,
      ingredientsResult.error,
      menuSectionResult.error,
      preparationIngredientsResult.error,
      preparationsResult.error,
      dishesResult.error, 
      dishComponentsResult.error, 
      // Removed errors for kitchens, kitchen_users
    ].filter(error => error !== null);
    
    if (errors.length > 0) {
      console.error('Errors occurred while fetching data:', errors);
      throw new Error('Multiple errors occurred while fetching data');
    }
    
    return allData;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

// Function to fetch all dishes with their related data (Refactored)
export async function fetchDishesWithRelatedData() { // Renamed function
  try {
    // Fetch all dishes first, including menu section and serving unit via FK
    const { data: dishes, error: dishesError } = await supabase
      .from('dishes') // Renamed from 'recipe'
      .select(`
        *,
        menu_section:dishes_menu_section_id_fkey (*),
        serving_unit:units!dishes_serving_unit_fkey (*)
      `);
    
    if (dishesError) throw dishesError;
    if (!dishes) return [];
    
    // Get all dish component links
    const dishIds = dishes.map(d => d.dish_id);
    const { data: allDishComponents, error: componentsError } = await supabase
        .from('dish_components')
        .select('*, unit:dish_components_unit_id_fkey(*)') // Select component unit
        .in('dish_id', dishIds);
    if (componentsError) throw componentsError;

    // Get details for all unique ingredients/preparations involved
    const allIngredientIds = [...new Set(allDishComponents?.map(dc => dc.ingredient_id) || [])];
    if (allIngredientIds.length === 0) { 
        // No components found, return dishes as fetched
        return dishes.map(dish => ({ ...dish, components: [] }));
    }

    // Fetch ingredient details (including base unit)
    const { data: allIngredients, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('*, base_unit:ingredients_unit_id_fkey(*)')
        .in('ingredient_id', allIngredientIds);
    if (ingredientsError) throw ingredientsError;
    const ingredientsMap = new Map(allIngredients?.map(ing => [ing.ingredient_id, ing]));

    // Fetch preparation details (for those ingredients that are preps)
    const { data: allPreparations, error: preparationsError } = await supabase
        .from('preparations')
        .select('*, yield_unit:preparations_yield_unit_id_fkey(*)')
        .in('preparation_id', allIngredientIds);
    if (preparationsError) throw preparationsError;
    const preparationsMap = new Map(allPreparations?.map(prep => [prep.preparation_id, prep]));

    // Fetch ingredients for all preparations involved
    const preparationIds = allPreparations?.map(p => p.preparation_id) || [];
    let allPrepIngredients: any[] = [];
    if (preparationIds.length > 0) {
        const { data: fetchedPrepIngs, error: prepIngsError } = await supabase
            .from('preparation_ingredients')
            .select('*, unit:preparation_ingredients_unit_id_fkey(*), ingredient:preparation_ingredients_ingredient_id_fkey(*)')
            .in('preparation_id', preparationIds);
        if (prepIngsError) throw prepIngsError;
        allPrepIngredients = fetchedPrepIngs || [];
    }
    // Group prep ingredients by preparation_id
    const prepIngredientsMap = new Map<string, any[]>();
    allPrepIngredients.forEach(pi => {
        if (!prepIngredientsMap.has(pi.preparation_id)) {
            prepIngredientsMap.set(pi.preparation_id, []);
        }
        prepIngredientsMap.get(pi.preparation_id)?.push(pi); // Store raw, transform later if needed
    });

    // Assemble the final structure
    const fullDishes = dishes.map(dish => {
        const componentsForThisDish = allDishComponents?.filter(dc => dc.dish_id === dish.dish_id) || [];
        
        const assembledComponents = componentsForThisDish.map(dc => {
            const ingredient = ingredientsMap.get(dc.ingredient_id);
            const preparation = preparationsMap.get(dc.ingredient_id);
            const isPreparation = !!preparation;

            let prepDetailsWithIngredients = null;
            if (isPreparation && preparation) {
                prepDetailsWithIngredients = {
                    ...preparation,
                    ingredients: prepIngredientsMap.get(preparation.preparation_id) || []
                };
            }

            // Return a structure resembling DishComponent, 
            // transformation can happen later if needed
            return {
                ingredient_id: dc.ingredient_id,
                name: ingredient?.name || 'Unknown',
                amount: dc.amount,
                unit: dc.unit, // Fetched component unit
                isPreparation: isPreparation,
                preparationDetails: prepDetailsWithIngredients, 
                rawIngredientDetails: !isPreparation ? ingredient : null 
            };
        });

        return {
            ...dish,
            components: assembledComponents, // Add assembled components
            // menuSection is already part of dish object from initial fetch
        };
    });
    
    return fullDishes;
  } catch (error) {
    console.error('Error fetching dishes with related data:', error);
    throw error;
  }
} 