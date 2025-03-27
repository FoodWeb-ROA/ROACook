import { supabase } from './supabaseClient';
import { Database } from './database.types';

// General data fetching function with error handling
export async function fetchData<T>(
  tableName: string, 
  options: {
    columns?: string;
    filter?: { column: string; value: any }[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    // Start the query
    let query = supabase
      .from(tableName)
      .select(options.columns || '*');

    // Apply filters if provided
    if (options.filter && options.filter.length > 0) {
      options.filter.forEach(f => {
        query = query.eq(f.column, f.value);
      });
    }

    // Apply ordering if provided
    if (options.order) {
      query = query.order(
        options.order.column, 
        { ascending: options.order.ascending ?? true }
      );
    }

    // Apply limit if provided
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Get a single result if requested
    if (options.single) {
      const { data, error } = await query.single();
      return { data: data as T, error: error as any };
    } 
    
    // Otherwise get multiple results
    const { data, error } = await query;
    return { data: data as T, error: error as any };

  } catch (error) {
    console.error(`Error fetching from ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Insert data into a table
export async function insertData<T>(
  tableName: string,
  data: any,
  options: {
    returnData?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    let query = supabase.from(tableName).insert(data);
    
    if (options.returnData) {
      query = query.select();
    }
    
    const { data: returnedData, error } = await query;
    
    return { 
      data: options.returnData ? (returnedData as T) : null, 
      error: error as any 
    };
  } catch (error) {
    console.error(`Error inserting into ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Update data in a table
export async function updateData<T>(
  tableName: string,
  data: any,
  filter: { column: string; value: any },
  options: {
    returnData?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    let query = supabase
      .from(tableName)
      .update(data)
      .eq(filter.column, filter.value);
    
    if (options.returnData) {
      query = query.select();
    }
    
    const { data: returnedData, error } = await query;
    
    return { 
      data: options.returnData ? (returnedData as T) : null, 
      error: error as any 
    };
  } catch (error) {
    console.error(`Error updating ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Delete data from a table
export async function deleteData<T>(
  tableName: string,
  filter: { column: string; value: any },
  options: {
    returnData?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    let query = supabase
      .from(tableName)
      .delete()
      .eq(filter.column, filter.value);
    
    if (options.returnData) {
      query = query.select();
    }
    
    const { data: returnedData, error } = await query;
    
    return { 
      data: options.returnData ? (returnedData as T) : null, 
      error: error as any 
    };
  } catch (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Fetch a recipe with related data (ingredients, preparations, menu section)
export async function fetchRecipeWithRelatedData(recipeId: number) {
  try {
    // Fetch recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipe')
      .select('*')
      .eq('recipe_id', recipeId)
      .single();
    
    if (recipeError) throw recipeError;
    
    // Fetch ingredients
    const { data: ingredients, error: ingredientsError } = await supabase
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
    
    // Fetch preparations
    const { data: preparations, error: preparationsError } = await supabase
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
    const { data: menuSection, error: menuSectionError } = await supabase
      .from('menu_section')
      .select('*')
      .eq('menu_section_id', recipe.menu_section_id)
      .single();
    
    // Menu section might be null, so only throw if it's not a "not found" error
    if (menuSectionError && menuSectionError.code !== 'PGRST116') {
      throw menuSectionError;
    }
    
    return {
      recipe,
      ingredients,
      preparations,
      menuSection
    };
  } catch (error) {
    console.error('Error fetching recipe with related data:', error);
    throw error;
  }
} 