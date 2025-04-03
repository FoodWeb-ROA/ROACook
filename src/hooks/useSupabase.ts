import { useState, useEffect } from 'react';
import { supabase } from '../data/supabaseClient';
import { Recipe } from '../types';
import { transformRecipe, transformRecipeIngredient, transformMenuSection } from '../utils/transforms';

/**
 * Hook to fetch all recipes with optional filter by menu section
 */
export function useRecipes(menuSectionId?: string) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRecipes() {
      try {
        setLoading(true);
        
        // First fetch basic recipe data
        let query = supabase
          .from('recipe')
          .select(`
            *,
            menu_section:menu_section_id (
              menu_section_id,
              name
            )
          `);
        
        // Apply menu section filter if provided
        if (menuSectionId) {
          query = query.eq('menu_section_id', menuSectionId);
        }
        
        const { data: recipesData, error: recipesError } = await query.order('recipe_name');
        
        if (recipesError) throw recipesError;

        // For each recipe, fetch its ingredients
        const recipesWithIngredients = await Promise.all(recipesData.map(async (recipe) => {
          // Fetch recipe ingredients
          const { data: recipeIngredients, error: ingredientsError } = await supabase
            .from('recipe_ingredients')
            .select(`
              *,
              ingredients (
                ingredient_id,
                name
              ),
              units (
                unit_id,
                unit_name,
                system,
                abbreviation
              )
            `)
            .eq('recipe_id', recipe.recipe_id);
            
          if (ingredientsError) {
            console.error('Error fetching ingredients:', ingredientsError);
            return {
              recipe_id: recipe.recipe_id,
              recipe_name: recipe.recipe_name,
              menu_section_id: recipe.menu_section_id,
              directions: recipe.directions,
              prep_time: parseInt(recipe.prep_time) || 0,
              total_time: parseInt(recipe.total_time) || 0,
              rest_time: parseInt(recipe.rest_time) || 0,
              servings: recipe.servings,
              cooking_notes: recipe.cooking_notes,
              ingredients: []
            };
          }
          
          // Log raw ingredients data for debugging
          console.log(`Recipe ${recipe.recipe_id} raw ingredients:`, JSON.stringify(recipeIngredients));
          
          // Transform the ingredients to the format expected by the UI
          const transformedIngredients = recipeIngredients.map(ingredient => {
            // Get default unit based on ingredient type
            const defaultUnit = getDefaultUnit(ingredient.ingredients?.name);
            
            // Use database unit if available, otherwise use the default
            const unitData = ingredient.units || {
              unit_id: defaultUnit.unit_id,
              unit_name: defaultUnit.unit_name,
              system: defaultUnit.system,
              abbreviation: defaultUnit.abbreviation
            };
            
            return transformRecipeIngredient({
              ...ingredient,
              // Add default unit information if missing
              units: unitData
            });
          });
          
          // Create a recipe object with the correct structure
          return {
            recipe_id: recipe.recipe_id,
            recipe_name: recipe.recipe_name,
            menu_section_id: recipe.menu_section_id,
            directions: recipe.directions,
            prep_time: parseInt(recipe.prep_time) || 0,
            total_time: parseInt(recipe.total_time) || 0,
            rest_time: parseInt(recipe.rest_time) || 0,
            servings: recipe.servings,
            cooking_notes: recipe.cooking_notes,
            ingredients: transformedIngredients,
            menu_section: transformMenuSection(recipe.menu_section)
          };
        }));
        
        setRecipes(recipesWithIngredients || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching recipes:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecipes();
  }, [menuSectionId]);

  return { recipes, loading, error };
}

/**
 * Hook to fetch a single recipe with all its related data
 */
export function useRecipeDetail(recipeId: string | undefined) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRecipeDetails() {
      if (!recipeId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch recipe with menu section
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipe')
          .select(`
            *,
            menu_section!inner (*)
          `)
          .eq('recipe_id', recipeId)
          .single();

        if (recipeError) throw recipeError;

        // Fetch recipe ingredients with their details and units
        const { data: recipeIngredients, error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .select(`
            *,
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
          .eq('recipe_id', recipeId);

        if (ingredientsError) throw ingredientsError;

        // Fetch recipe preparations with their details
        const { data: recipePreparations, error: preparationsError } = await supabase
          .from('recipe_preparations')
          .select(`
            *,
            preparations!inner (*),
            units!inner (
              unit_id,
              unit_name,
              system
            )
          `)
          .eq('recipe_id', recipeId);

        if (preparationsError) throw preparationsError;

        // For each preparation, fetch its ingredients
        for (const prep of recipePreparations) {
          const { data: prepIngredients, error: prepIngredientsError } = await supabase
            .from('preparation_ingredients')
            .select(`
              *,
              ingredients!inner (
                ingredient_id,
                name
              ),
              units!inner (
                unit_id,
                unit_name,
                system
              )
            `)
            .eq('preparation_id', prep.preparation_id);
          
          if (prepIngredientsError) throw prepIngredientsError;
          
          // Attach ingredients to the preparation
          prep.preparation_ingredients = prepIngredients;
        }

        // Transform the data to our UI type
        const transformedRecipe = transformRecipe(
          recipeData,
          recipeData.menu_section,
          recipeIngredients,
          recipePreparations
        );

        setRecipe(transformedRecipe);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching recipe details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecipeDetails();
  }, [recipeId]);

  return { recipe, loading, error };
}

/**
 * Hook to fetch all menu sections (categories)
 */
export function useMenuSections() {
  const [menuSections, setMenuSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMenuSections() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('menu_section')
          .select('*')
          .order('name');
        
        if (error) throw error;
        
        setMenuSections(data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching menu sections:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMenuSections();
  }, []);

  return { menuSections, loading, error };
}

/**
 * Hook to fetch a single preparation with all its related data
 */
export function usePreparationDetail(preparationId: string | undefined) {
  const [preparation, setPreparation] = useState<any | null>(null);
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
        
        // Fetch preparation
        const { data: preparationData, error: preparationError } = await supabase
          .from('preparations')
          .select('*')
          .eq('preparation_id', preparationId)
          .single();
        
        if (preparationError) throw preparationError;
        
        // Fetch preparation ingredients
        const { data: preparationIngredients, error: ingredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            *,
            ingredients!inner (
              ingredient_id,
              name
            ),
            units!inner (
              unit_id,
              unit_name,
              system
            )
          `)
          .eq('preparation_id', preparationId);
        
        if (ingredientsError) throw ingredientsError;

        // Process ingredients data
        const formattedIngredients = preparationIngredients?.map(item => ({
          ingredient_id: item.ingredients.ingredient_id,
          name: item.ingredients.name,
          amount: item.amount,
          unit_id: item.unit_id,
          unit_name: item.units.unit_name,
          system: item.units.system
        })) || [];
        
        // Set states
        setPreparation(preparationData);
        setIngredients(formattedIngredients);
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
 * Hook to search recipes
 */
export function useRecipeSearch(searchQuery: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function searchRecipes() {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        
        // Search by recipe name
        const { data, error } = await supabase
          .from('recipe')
          .select('*')
          .ilike('recipe_name', `%${searchQuery}%`)
          .order('recipe_name');
        
        if (error) throw error;
        
        setResults(data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error searching recipes:', err);
      } finally {
        setLoading(false);
      }
    }

    // Add debounce to avoid too many searches while typing
    const debounceTimeout = setTimeout(() => {
      searchRecipes();
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  return { results, loading, error };
}

// Helper function to get default unit based on ingredient name
function getDefaultUnit(ingredientName: string = ''): { unit_id: string, unit_name: string, system: string, abbreviation: string } {
  const lowerName = ingredientName.toLowerCase();
  
  // Common liquids
  if (lowerName.includes('milk') || 
      lowerName.includes('oil') || 
      lowerName.includes('broth') || 
      lowerName.includes('stock')) {
    return { unit_id: 'ml', unit_name: 'milliliter', system: 'metric', abbreviation: 'ml' };
  }
  
  // Common counted items
  if (lowerName.includes('egg') || 
      lowerName.includes('onion') || 
      lowerName.includes('garlic') || 
      lowerName.includes('pepper')) {
    return { unit_id: 'count', unit_name: 'count', system: 'count', abbreviation: '' };
  }
  
  // Default to grams for most ingredients
  return { unit_id: 'g', unit_name: 'gram', system: 'metric', abbreviation: 'g' };
} 