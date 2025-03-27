import { useState, useEffect } from 'react';
import { supabase } from '../data/supabaseClient';

/**
 * Hook to fetch all recipes with optional filter by menu section
 */
export function useRecipes(menuSectionId?: number) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRecipes() {
      try {
        setLoading(true);
        
        let query = supabase.from('recipe').select('*');
        
        // Apply menu section filter if provided
        if (menuSectionId) {
          query = query.eq('menu_section_id', menuSectionId);
        }
        
        const { data, error } = await query.order('recipe_name');
        
        if (error) throw error;
        
        setRecipes(data || []);
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
export function useRecipeDetail(recipeId: number | undefined) {
  const [recipe, setRecipe] = useState<any | null>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [preparations, setPreparations] = useState<any[]>([]);
  const [menuSection, setMenuSection] = useState<any | null>(null);
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
        
        // Fetch recipe
        const { data: recipeData, error: recipeError } = await supabase
          .from('recipe')
          .select('*')
          .eq('recipe_id', recipeId)
          .single();
        
        if (recipeError) throw recipeError;
        
        // Fetch recipe ingredients
        const { data: ingredientsData, error: ingredientsError } = await supabase
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
          .eq('recipe_id', recipeId);
        
        if (ingredientsError) throw ingredientsError;
        
        // Fetch recipe preparations
        const { data: preparationsData, error: preparationsError } = await supabase
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
          .eq('recipe_id', recipeId);
        
        if (preparationsError) throw preparationsError;
        
        // Fetch menu section
        const { data: menuSectionData, error: menuSectionError } = await supabase
          .from('menu_section')
          .select('*')
          .eq('menu_section_id', recipeData.menu_section_id)
          .single();
        
        if (menuSectionError && menuSectionError.code !== 'PGRST116') { // Ignore "not found" errors
          throw menuSectionError;
        }

        // Process ingredients data
        const formattedIngredients = ingredientsData?.map(item => ({
          ...item.ingredients,
          amount: item.amount
        })) || [];

        // Process preparations data
        const formattedPreparations = preparationsData || [];
        
        // Set states
        setRecipe(recipeData);
        setIngredients(formattedIngredients);
        setPreparations(formattedPreparations);
        setMenuSection(menuSectionData || null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        console.error('Error fetching recipe details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecipeDetails();
  }, [recipeId]);

  return { recipe, ingredients, preparations, menuSection, loading, error };
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
export function usePreparationDetail(preparationId: number | undefined) {
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
        const { data: ingredientsData, error: ingredientsError } = await supabase
          .from('preparation_ingredients')
          .select(`
            amount,
            ingredients:ingredients!inner (
              ingredient_id,
              name
            )
          `)
          .eq('preparation_id', preparationId);
        
        if (ingredientsError) throw ingredientsError;

        // Process ingredients data
        const formattedIngredients = ingredientsData?.map(item => ({
          ...item.ingredients,
          amount: item.amount
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