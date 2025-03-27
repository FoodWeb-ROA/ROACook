import fs from 'fs';
import path from 'path';
import { supabase } from '../src/data/supabaseClient';

// Define types for our data
interface Ingredient {
  ingredient_id: number;
  name: string;
  inventory_amount: number | null;
  user_id: number;
}

interface IngredientRef {
  ingredient_id: number;
  name: string;
}

interface PreparationIngredient {
  preparation_id: number;
  amount: number;
  ingredients: IngredientRef;
}

interface Preparation {
  preparation_id: number;
  amount: number;
  amount_unit: string;
  created_at: string;
  updated_at: string;
}

interface RecipePreparation {
  amount: number;
  preparations: Preparation;
}

interface MenuSection {
  menu_section_id: number;
  name: string;
}

interface RecipeIngredient {
  amount: number;
  ingredients: Ingredient;
}

/**
 * Fetch detailed recipe data including all related entities
 */
async function fetchDetailedRecipes() {
  try {
    console.log('Fetching detailed recipe data...');
    
    // Get all recipes
    const { data: recipes, error: recipesError } = await supabase
      .from('recipe')
      .select('*')
      .order('recipe_name');
    
    if (recipesError) {
      throw recipesError;
    }
    
    console.log(`Found ${recipes.length} recipes. Fetching details...`);
    
    // For each recipe, get all their details
    const detailedRecipes = await Promise.all(recipes.map(async (recipe) => {
      // Get ingredients with their details
      const { data: recipeIngredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select(`
          amount,
          ingredients:ingredients!inner (
            ingredient_id,
            name,
            inventory_amount,
            user_id
          )
        `)
        .eq('recipe_id', recipe.recipe_id);
      
      if (ingredientsError) {
        console.error(`Error fetching ingredients for recipe ${recipe.recipe_id}:`, ingredientsError);
      }
      
      // Get preparations with their ingredients
      const { data: recipePreparations, error: preparationsError } = await supabase
        .from('recipe_preparations')
        .select(`
          amount,
          preparations:preparations!inner (
            preparation_id,
            amount,
            amount_unit,
            created_at,
            updated_at
          )
        `)
        .eq('recipe_id', recipe.recipe_id);
      
      if (preparationsError) {
        console.error(`Error fetching preparations for recipe ${recipe.recipe_id}:`, preparationsError);
      }
      
      // Get preparations ingredients
      let preparationIngredients: Array<PreparationIngredient> = [];
      if (recipePreparations && recipePreparations.length > 0) {
        const preparationIds = recipePreparations.map(p => p.preparations.preparation_id);
        
        const { data: prepIngredients, error: prepIngredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            preparation_id,
            amount,
            ingredients:ingredients!inner (
              ingredient_id,
              name
            )
          `)
          .in('preparation_id', preparationIds);
        
        if (prepIngredientsError) {
          console.error(`Error fetching preparation ingredients:`, prepIngredientsError);
        } else if (prepIngredients) {
          // Use type assertion after checking that data exists
          preparationIngredients = prepIngredients as unknown as Array<PreparationIngredient>;
        }
      }
      
      // Get menu section
      const { data: menuSection, error: menuSectionError } = await supabase
        .from('menu_section')
        .select('*')
        .eq('menu_section_id', recipe.menu_section_id)
        .single();
      
      if (menuSectionError) {
        console.error(`Error fetching menu section for recipe ${recipe.recipe_id}:`, menuSectionError);
      }
      
      // Map preparation ingredients to their preparations
      const preparationsWithIngredients = recipePreparations?.map(prep => {
        const prepIngredients = preparationIngredients.filter(
          pi => pi.preparation_id === prep.preparations.preparation_id
        );
        
        return {
          ...prep.preparations,
          amount: prep.amount,
          ingredients: prepIngredients || []
        };
      }) || [];
      
      // Return complete recipe object with all relations
      return {
        ...recipe,
        menu_section: menuSection || null,
        ingredients: recipeIngredients?.map(ri => ({
          ...ri.ingredients,
          amount: ri.amount
        })) || [],
        preparations: preparationsWithIngredients
      };
    }));
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save to file
    const filePath = path.join(outputDir, 'detailed-recipes.json');
    fs.writeFileSync(filePath, JSON.stringify(detailedRecipes, null, 2));
    
    console.log(`Exported ${detailedRecipes.length} detailed recipes to ${filePath}`);
    return detailedRecipes;
  } catch (error) {
    console.error('Error fetching detailed recipes:', error);
    throw error;
  }
}

// Run the function
fetchDetailedRecipes().catch(error => {
  console.error('Failed to fetch detailed recipes:', error);
  process.exit(1);
}); 