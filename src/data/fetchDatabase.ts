import { supabase } from './supabaseClient';

export async function fetchAllData() {
  try {
    // Fetch all tables data
    const [
      unitsResult,
      ingredientsResult,
      menuSectionResult,
      preparationIngredientsResult,
      preparationsResult,
      recipeResult,
      recipeIngredientsResult,
      recipePreparationsResult,
      kitchensResult,
      kitchenMembersResult,
      userTypesResult,
      usersResult
    ] = await Promise.all([
      supabase.from('units').select('*'),
      supabase.from('ingredients').select('*'),
      supabase.from('menu_section').select('*'),
      supabase.from('preparation_ingredients').select('*'),
      supabase.from('preparations').select('*'),
      supabase.from('recipe').select('*'),
      supabase.from('recipe_ingredients').select('*'),
      supabase.from('recipe_preparations').select('*'),
      supabase.from('kitchens').select('*'),
      supabase.from('kitchen_members').select('*'),
      supabase.from('user_types').select('*'),
      supabase.from('users').select('*')
    ]);

    // Compile all results
    const allData = {
      units: unitsResult.data || [],
      ingredients: ingredientsResult.data || [],
      menuSections: menuSectionResult.data || [],
      preparationIngredients: preparationIngredientsResult.data || [],
      preparations: preparationsResult.data || [],
      recipes: recipeResult.data || [],
      recipeIngredients: recipeIngredientsResult.data || [],
      recipePreparations: recipePreparationsResult.data || [],
      kitchens: kitchensResult.data || [],
      kitchenMembers: kitchenMembersResult.data || [],
      userTypes: userTypesResult.data || [],
      users: usersResult.data || []
    };
    
    // Log any errors
    const errors = [
      unitsResult.error,
      ingredientsResult.error,
      menuSectionResult.error,
      preparationIngredientsResult.error,
      preparationsResult.error,
      recipeResult.error,
      recipeIngredientsResult.error,
      recipePreparationsResult.error,
      kitchensResult.error,
      kitchenMembersResult.error,
      userTypesResult.error,
      usersResult.error
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

// Function to fetch all recipes with their related data
export async function fetchRecipesWithRelatedData() {
  try {
    const { data: recipes, error: recipesError } = await supabase
      .from('recipe')
      .select('*');
    
    if (recipesError) throw recipesError;
    
    // Get recipe ingredients for each recipe
    const fullRecipes = await Promise.all(recipes.map(async (recipe) => {
      // Get ingredients
      const { data: recipeIngredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select(`
          amount,
          unit_id,
          ingredients (
            ingredient_id,
            name
          ),
          units (
            unit_id,
            unit_name,
            system
          )
        `)
        .eq('recipe_id', recipe.recipe_id);
      
      if (ingredientsError) console.error('Error fetching ingredients:', ingredientsError);
      
      // Get preparations
      const { data: recipePreparations, error: preparationsError } = await supabase
        .from('recipe_preparations')
        .select(`
          amount,
          unit_id,
          preparations (
            preparation_id,
            preparation_name,
            directions,
            prep_time,
            total_time,
            rest_time,
            servings,
            cooking_notes
          ),
          units (
            unit_id,
            unit_name,
            system
          )
        `)
        .eq('recipe_id', recipe.recipe_id);
      
      if (preparationsError) console.error('Error fetching preparations:', preparationsError);
      
      // For each preparation, fetch its ingredients
      for (const prep of recipePreparations || []) {
        // Use type assertion to tell TypeScript what structure we expect
        const preparation = prep.preparations as any;
        const preparationId = preparation.preparation_id;
        
        const { data: prepIngredients, error: prepIngredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            amount,
            unit_id,
            ingredients (
              ingredient_id,
              name
            ),
            units (
              unit_id,
              unit_name,
              system
            )
          `)
          .eq('preparation_id', preparationId);
        
        if (prepIngredientsError) {
          console.error('Error fetching preparation ingredients:', prepIngredientsError);
        } else {
          // Attach ingredients to the preparation object
          preparation.ingredients = prepIngredients || [];
        }
      }
      
      // Get menu section
      const { data: menuSection, error: menuSectionError } = await supabase
        .from('menu_section')
        .select('*')
        .eq('menu_section_id', recipe.menu_section_id)
        .single();
      
      if (menuSectionError) console.error('Error fetching menu section:', menuSectionError);
      
      return {
        ...recipe,
        ingredients: recipeIngredients || [],
        preparations: recipePreparations || [],
        menuSection: menuSection || null
      };
    }));
    
    return fullRecipes;
  } catch (error) {
    console.error('Error fetching recipes with related data:', error);
    throw error;
  }
} 