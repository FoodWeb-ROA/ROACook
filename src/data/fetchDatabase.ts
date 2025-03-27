import { supabase } from './supabaseClient';

export async function fetchAllData() {
  try {
    // Fetch all tables data
    const [
      baseUnitsResult,
      ingredientsResult,
      menuSectionResult,
      preparationIngredientsResult,
      preparationsResult,
      recipeResult,
      recipeIngredientsResult,
      recipePreparationsResult,
      userTypesResult,
      usersResult
    ] = await Promise.all([
      supabase.from('base_units').select('*'),
      supabase.from('ingredients').select('*'),
      supabase.from('menu_section').select('*'),
      supabase.from('preparation_ingredients').select('*'),
      supabase.from('preparations').select('*'),
      supabase.from('recipe').select('*'),
      supabase.from('recipe_ingredients').select('*'),
      supabase.from('recipe_preparations').select('*'),
      supabase.from('user_types').select('*'),
      supabase.from('users').select('*')
    ]);

    // Compile all results
    const allData = {
      baseUnits: baseUnitsResult.data || [],
      ingredients: ingredientsResult.data || [],
      menuSections: menuSectionResult.data || [],
      preparationIngredients: preparationIngredientsResult.data || [],
      preparations: preparationsResult.data || [],
      recipes: recipeResult.data || [],
      recipeIngredients: recipeIngredientsResult.data || [],
      recipePreparations: recipePreparationsResult.data || [],
      userTypes: userTypesResult.data || [],
      users: usersResult.data || []
    };
    
    // Log any errors
    const errors = [
      baseUnitsResult.error,
      ingredientsResult.error,
      menuSectionResult.error,
      preparationIngredientsResult.error,
      preparationsResult.error,
      recipeResult.error,
      recipeIngredientsResult.error,
      recipePreparationsResult.error,
      userTypesResult.error,
      usersResult.error
    ].filter(error => error !== null);
    
    if (errors.length > 0) {
      console.error('Some data fetching operations failed:', errors);
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
          ingredients (
            ingredient_id,
            name
          )
        `)
        .eq('recipe_id', recipe.recipe_id);
      
      if (ingredientsError) console.error('Error fetching ingredients:', ingredientsError);
      
      // Get preparations
      const { data: recipePreparations, error: preparationsError } = await supabase
        .from('recipe_preparations')
        .select(`
          amount,
          preparations (
            preparation_id,
            ingredient_id,
            amount,
            amount_unit
          )
        `)
        .eq('recipe_id', recipe.recipe_id);
      
      if (preparationsError) console.error('Error fetching preparations:', preparationsError);
      
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