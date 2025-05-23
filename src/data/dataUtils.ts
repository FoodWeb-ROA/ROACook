import { supabase } from './supabaseClient';
import { Database } from './database.types';
import { appLogger } from '../services/AppLogService';

// Define a type for valid table names based on the generated Database types
type TableName = keyof Database['public']['Tables'];

// General data fetching function with error handling
export async function fetchData<T>(
  tableName: TableName,
  options: {
    columns?: string;
    filter?: { column: string; value: any }[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    // Rely on inference for the query variable type
    let query = supabase
      .from(tableName)
      .select(options.columns || '*');

    // Apply filters - Inference should allow .eq here
    if (options.filter && options.filter.length > 0) {
      options.filter.forEach(f => {
        query = query.eq(f.column, f.value);
      });
    }

    // Apply ordering - Inference should allow .order here
    if (options.order) {
      query = query.order(
        options.order.column, 
        { ascending: options.order.ascending ?? true }
      );
    }

    // Apply limit - Inference should allow .limit here
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Apply single - Inference should allow .single here
    if (options.single) {
      const { data, error } = await query.single(); // .single() changes return type
      return { data: data as T, error: error as any };
    } 
    
    // Await the query - Type T is asserted on return
    const { data, error } = await query;
    return { data: data as T, error: error as any };

  } catch (error) {
    appLogger.error(`Error fetching from ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Insert data into a table
export async function insertData<T>(
  tableName: TableName,
  data: any,
  options: {
    returnData?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const query = supabase.from(tableName).insert(data);
    
    if (options.returnData) {
      // If returnData is true, chain select and await
      const { data: returnedData, error } = await query.select().single(); // Often you insert one or want one back
      return { data: returnedData as T | null, error: error as any };
    } else {
      // Otherwise, just await the insert operation without select
      const { error } = await query;
      return { data: null, error: error as any };
    }
    
  } catch (error) {
    appLogger.error(`Error inserting into ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Update data in a table
export async function updateData<T>(
  tableName: TableName,
  data: any,
  filter: { column: string; value: any },
  options: {
    returnData?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const query = supabase
      .from(tableName)
      .update(data)
      .eq(filter.column, filter.value);
      
    if (options.returnData) {
      // Chain select and await
      const { data: returnedData, error } = await query.select(); // Select potentially returns multiple rows
      return { data: returnedData as T | null, error: error as any };
    } else {
       // Await update without select
      const { error } = await query;
      return { data: null, error: error as any };
    }

  } catch (error) {
    appLogger.error(`Error updating ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Delete data from a table
export async function deleteData<T>(
  tableName: TableName,
  filter: { column: string; value: any },
  options: {
    returnData?: boolean;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const query = supabase
      .from(tableName)
      .delete()
      .eq(filter.column, filter.value);
    
    if (options.returnData) {
       // Chain select and await
      const { data: returnedData, error } = await query.select();
      return { data: returnedData as T | null, error: error as any };
    } else {
       // Await delete without select
       const { error } = await query;
       return { data: null, error: error as any };
    }

  } catch (error) {
    appLogger.error(`Error deleting from ${tableName}:`, error);
    return { data: null, error: error as any };
  }
}

// Fetch a dish with related data (components, menu section)
export async function fetchDishWithRelatedData(dishId: string) {
  try {
    // Fetch dish
    const { data: dish, error: dishError } = await supabase
      .from('dishes')
      .select('*')
      .eq('dish_id', dishId)
      .single();
    
    if (dishError) throw dishError;
    if (!dish) throw new Error('Dish not found');
    
    // Fetch dish components (replaces ingredients)
    const { data: components, error: componentsError } = await supabase
      .from('dish_components')
      .select(`
        *,
        unit:dish_components_unit_id_fkey(*),
        ingredient:dish_components_ingredient_id_fkey (
          *,
          preparation:preparations!preparation_id (*)
        )
      `)
      .eq('dish_id', dishId);
    
    if (componentsError) throw componentsError;
    
    // Removed fetching of recipe_preparations
    
    // Fetch menu section (check if menu_section_id exists on dish)
    let menuSection = null;
    let menuSectionError = null;
    if (dish.menu_section_id) {
        const { data: msData, error: msError } = await supabase
            .from('menu_section')
            .select('*')
            .eq('menu_section_id', dish.menu_section_id)
            .single();
        menuSection = msData;
        menuSectionError = msError;
    }
    
    // Menu section might be null, so only throw if it's not a "not found" error
    if (menuSectionError && menuSectionError.code !== 'PGRST116') {
      throw menuSectionError;
    }
    
    // Return dish, components, and menuSection
    return {
      dish,
      components,
      menuSection
    };
  } catch (error) {
    appLogger.error('Error fetching dish with related data:', error);
    throw error;
  }
} 