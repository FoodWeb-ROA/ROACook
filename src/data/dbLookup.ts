'use strict';

import { supabase } from './supabaseClient';
import { Ingredient, Preparation, Dish, PreparationIngredient } from '../types'; // Assuming types are defined here
import { DbUnit, FetchedIngredientDetail, FetchedPreparationDataCombined, FetchedPreparationDetail, FetchedPreparationIngredient, transformPreparation, transformPreparationIngredient, transformUnit } from '../utils/transforms';

// --- Ingredient Lookups ---

/**
 * Checks if an ingredient name already exists (case-insensitive).
 * Returns the existing ingredient ID if found, otherwise null.
 */
export const checkIngredientNameExists = async (name: string): Promise<string | null> => {
  if (!name?.trim()) return null;
  try {
    const { data, error } = await supabase
      .from('ingredients')
      .select('ingredient_id')
      .ilike('name', name.trim()) // Case-insensitive match
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
      console.error('Error checking ingredient name:', error);
      throw error; // Re-throw unexpected errors
    }
    return data?.ingredient_id || null;
  } catch (error) {
    console.error('Supabase call failed (checkIngredientNameExists):', error);
    return null; // Return null on failure to avoid blocking UX
  }
};

/**
 * Finds ingredients with names similar to the query (case-insensitive prefix/suffix match).
 * Also flags if the ingredient is a preparation.
 */
export const findCloseIngredient = async (
    name: string,
    limit: number = 10
): Promise<(Ingredient & { isPreparation?: boolean })[]> => {
    if (!name?.trim()) return [];
    const searchTerm = `%${name.trim()}%`;

    try {
        // Step 1: Find ingredients matching the name
        const { data: ingredientsData, error: ingredientsError } = await supabase
            .from('ingredients')
            .select(`
                ingredient_id,
                name,
                unit_id,
                amount,
                synonyms,
                cooking_notes,
                storage_location
            `)
            .ilike('name', searchTerm)
            .limit(limit);

        if (ingredientsError) {
            console.error('Error finding close ingredients (step 1):', ingredientsError);
            throw ingredientsError;
        }

        if (!ingredientsData || ingredientsData.length === 0) {
            return [];
        }

        // Step 2: Check which of these ingredients are also preparations
        const ingredientIds = ingredientsData.map(ing => ing.ingredient_id);
        const { data: preparationsData, error: preparationsError } = await supabase
            .from('preparations')
            .select('preparation_id')
            .in('preparation_id', ingredientIds);

        if (preparationsError) {
            console.error('Error checking preparations link (step 2):', preparationsError);
            // Decide how to handle this - return partial results or throw?
            // For now, let's return ingredients without the isPreparation flag set correctly.
            return ingredientsData.map(ing => ({ ...(ing as Ingredient), isPreparation: false }));
        }

        const preparationIds = new Set(preparationsData?.map(p => p.preparation_id) || []);

        // Step 3: Combine results
        const results = ingredientsData.map((ing: any) => ({
            ...(ing as Ingredient),
            isPreparation: preparationIds.has(ing.ingredient_id),
        }));

        return results;

    } catch (error) {
        console.error('Supabase call failed (findCloseIngredient):', error);
        return [];
    }
};


// --- Preparation Lookups ---

/**
 * Checks if a preparation with the exact same fingerprint already exists.
 * Returns the existing preparation ID if found, otherwise null.
 */
export const findPreparationByFingerprint = async (fingerprint: string): Promise<string | null> => {
  if (!fingerprint) return null;
  try {
    const { data, error } = await supabase
      .from('preparations') // Assuming fingerprint is on preparations table
      .select('preparation_id')
      .eq('fingerprint', fingerprint)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding preparation by fingerprint:', error);
      throw error;
    }
    return data?.preparation_id || null;
  } catch (error) {
    console.error('Supabase call failed (findPreparationByFingerprint):', error);
    return null;
  }
};

/**
 * Checks if a preparation name already exists (case-insensitive).
 * This is useful when fingerprint differs but name clashes.
 * Returns the existing preparation ID if found, otherwise null.
 */
export const checkPreparationNameExists = async (name: string): Promise<string | null> => {
  if (!name?.trim()) return null;
  try {
    // 1. Find ingredient by name (case-insensitive)
    const { data: ing, error: ingErr } = await supabase
      .from('ingredients')
      .select('ingredient_id')
      .ilike('name', name.trim())
      .limit(1)
      .single();

    if (ingErr && ingErr.code !== 'PGRST116') {
      console.error('Error checking ingredient for preparation name:', ingErr);
      throw ingErr;
    }

    if (!ing) return null; // No ingredient with that name

    // 2. Check if that ingredient has a matching row in preparations table
    const { data: prep, error: prepErr } = await supabase
      .from('preparations')
      .select('preparation_id')
      .eq('preparation_id', ing.ingredient_id)
      .limit(1)
      .single();

    if (prepErr && prepErr.code !== 'PGRST116') {
      console.error('Error checking preparations link:', prepErr);
      throw prepErr;
    }

    return prep ? ing.ingredient_id : null;

  } catch (error) {
    console.error('Supabase call failed (checkPreparationNameExists):', error);
    return null;
  }
};


// --- Dish Lookups ---

/**
 * Checks if a dish name already exists (case-insensitive).
 * Returns the existing dish ID if found, otherwise null.
 */
export const findDishByName = async (name: string): Promise<string | null> => {
  if (!name?.trim()) return null;
  try {
    const { data, error } = await supabase
      .from('dishes')
      .select('dish_id')
      .ilike('dish_name', name.trim())
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding dish by name:', error);
      throw error;
    }
    return data?.dish_id || null;
  } catch (error) {
    console.error('Supabase call failed (findDishByName):', error);
    return null;
  }
}; 


export const fetchPreparationDetailsFromDB = async (preparationId: string | undefined) => {
  if (!preparationId) {
    return { preparation: null, ingredients: [] };
  }

  try {
    // Fetch preparation data (requires joining with ingredients for combined info)
    const { data: prepJoinData, error: preparationError } = await supabase
      .from('preparations')
      .select(`
        *,
        yield_unit:units!preparations_amount_unit_id_fkey (*),
        ingredient:ingredients!preparations_preparation_id_fkey (
          *,
          base_unit:ingredients_unit_id_fkey(*)
        )
      `)
      .eq('preparation_id', preparationId)
      .single(); // Fetch all columns from preparations

    if (preparationError) throw preparationError;
    // Safely access potentially null ingredient data
    const ingredientDetails = prepJoinData?.ingredient as (FetchedIngredientDetail & {
      amount: number;
      kitchen_id: string | null;
    }) | null;
    // Type assertion for prepJoinData base properties
    const prepBaseDetails = prepJoinData as FetchedPreparationDetail | null;

    if (!prepBaseDetails || !ingredientDetails) {
      throw new Error(`Preparation ${preparationId} or its linked ingredient not found.`);
    }

    // Construct the combined data for transformation
    const combinedDataForTransform: FetchedPreparationDataCombined = {
      // Fields from FetchedIngredientDetail
      ingredient_id: ingredientDetails.ingredient_id,
      name: ingredientDetails.name,
      cooking_notes: ingredientDetails.cooking_notes,
      storage_location: ingredientDetails.storage_location,
      unit_id: ingredientDetails.unit_id,
      base_unit: ingredientDetails.base_unit,
      deleted: ingredientDetails.deleted,
      kitchen_id: ingredientDetails.kitchen_id || '',
      synonyms: ingredientDetails.synonyms,
      // Fields from FetchedPreparationDetail (using prepBaseDetails)
      preparation_id: prepBaseDetails.preparation_id,
      directions: prepBaseDetails.directions,
      total_time: prepBaseDetails.total_time,
      yield_unit: prepBaseDetails.yield_unit,
      amount_unit_id: prepBaseDetails.amount_unit_id, // Include amount_unit_id
      fingerprint: prepBaseDetails.fingerprint, // Include fingerprint
      // Fields explicitly required by FetchedPreparationDataCombined
      amount: ingredientDetails.amount ?? 0,
      created_at: ingredientDetails.created_at ?? null,
      updated_at: ingredientDetails.updated_at ?? null,
    };

    // Transform the base preparation details
    const transformedPrep = transformPreparation(combinedDataForTransform);

    // Fetch sub-ingredients for the preparation
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('preparation_ingredients')
      .select(`
        *,
        unit:units!fk_prep_ingredients_unit (*),
        ingredient:ingredients!fk_prep_ingredients_ing (
          name,
          ingredient_id
        )
      `)
      .eq('preparation_id', preparationId) as {
        data: (FetchedPreparationIngredient & {
          unit: DbUnit | null;
          ingredient: {
            name: string;
            ingredient_id: string;
          } | null;
        })[] | null;
        error: any;
      };

    if (ingredientsError) throw ingredientsError;

    // Get list of ingredient IDs from the fetched data
    const ingredientIds = (ingredientsData || [])
      .map(ing => ing.ingredient?.ingredient_id)
      .filter(id => id !== null) as string[];

    // Perform a separate query to check which of these IDs are also preparations
    let preparationIdSet = new Set<string>();
    if (ingredientIds.length > 0) {
      const { data: prepCheckData, error: prepCheckError } = await supabase
        .from('preparations')
        .select('preparation_id')
        .in('preparation_id', ingredientIds);

      if (prepCheckError) {
        console.warn(`[fetchPreparationDetailsFromDB] Failed to check for nested preparations:`, prepCheckError);
        // Continue without prep checks if this fails
      } else {
        preparationIdSet = new Set(prepCheckData?.map(p => p.preparation_id) || []);
      }
    }

    // Add transformed ingredients to the preparation object
    transformedPrep.ingredients = (ingredientsData || []).map(ing => {
      // Check if ingredient data exists before accessing properties
      const ingredientName = ing.ingredient?.name || 'Unknown Ingredient';
      const ingredientId = ing.ingredient?.ingredient_id || '';
      // Use the result from the separate query
      const isPreparation = preparationIdSet.has(ingredientId);

      return {
        preparation_id: ing.preparation_id || '',
        ingredient_id: ingredientId,
        name: ingredientName,
        amount: ing.amount ?? 0,
        unit: transformUnit(ing.unit),
        isPreparation: isPreparation,
      };
    });

    return { preparation: transformedPrep, ingredients: transformedPrep.ingredients || [] };
  } catch (error) {
    console.error(`Error fetching preparation ${preparationId}:`, error);
    return { preparation: null, ingredients: [] };
  }
};

// export const fetchPreparationDetailsFromDB = async (preparationId: string | undefined) => {
//   if (!preparationId) {
//     return { preparation: null, ingredients: [] };
//   }

//   try {
//     // Шаг 1: Получение основной информации о заготовке
//     const { data: preparationData, error: preparationError } = await supabase
//       .from('preparations')
//       .select(`
//         *,
//         amount_unit:units!preparations_amount_unit_id_fkey (*)
//       `)
//       .eq('preparation_id', preparationId)
//       .single();

//     if (preparationError) {
//       console.error("Error fetching preparation data:", preparationError);
//       return { preparation: null, ingredients: [] };
//     }

//     if (!preparationData) {
//       console.warn(`Preparation with ID ${preparationId} not found.`);
//       return { preparation: null, ingredients: [] };
//     }

//     // Трансформируем базовые данные заготовки
//     const transformedPrepBase = transformBasePreparation(preparationData);

//     // Шаг 2: Получение информации об основном ингредиенте заготовки
//     const { data: ingredientData, error: ingredientError } = await supabase
//       .from('ingredients')
//       .select(`
//         name,
//         cooking_notes
//       `)
//       .eq('ingredient_id', preparationData.preparation_id) // Используем preparation_id как ingredient_id
//       .single();

//     if (ingredientError) {
//       console.warn("Error fetching main ingredient data for preparation:", ingredientError);
//       // Решите, как обрабатывать отсутствие основного ингредиента
//     }

//     if (ingredientData && transformedPrepBase) {
//       transformedPrepBase.name = ingredientData.name;
//       transformedPrepBase.cooking_notes = ingredientData.cooking_notes ?? null;
//     }

//     // Шаг 3: Получение ингредиентов, входящих в состав заготовки
//     const { data: ingredientsData, error: ingredientsError } = await supabase
//       .from('preparation_ingredients')
//       .select(`
//         *,
//         unit:units!fk_prep_ingredients_unit (*),
//         ingredient:ingredients!fk_prep_ingredients_ing (*)
//       `)
//       .eq('preparation_id', preparationId);

//     if (ingredientsError) {
//       console.error("Error fetching sub-ingredients for preparation:", ingredientsError);
//       return { preparation: null, ingredients: [] };
//     }

//     const transformedIngredients: PreparationIngredient[] = (ingredientsData || []).map(transformPreparationIngredient);

//     if (transformedPrepBase) {
//       transformedPrepBase.ingredients = transformedIngredients;
//     }

//     return { preparation: transformedPrepBase || null, ingredients: transformedIngredients };

//   } catch (error) {
//     console.error(`Error fetching preparation ${preparationId}:`, error);
//     return { preparation: null, ingredients: [] };
//   }
// };

// // Функция для трансформации базовой информации о заготовке
// function transformBasePreparation(data: {
//   preparation_id: string;
//   directions: string;
//   total_time: number | null;
//   amount_unit: DbUnit | null;
//   amount_unit_id: string | null;
//   fingerprint: string | null;
//   created_at: string | null;
//   updated_at: string | null;
//   deleted: boolean | null;
// }): Preparation {
//   return {
//     preparation_id: data.preparation_id,
//     name: 'Loading...', // Временное значение
//     directions: data.directions || null,
//     total_time: data.total_time || null,
//     yield_unit: transformUnit(data.amount_unit),
//     yield_amount: null, // Пока нет данных об основном ингредиенте
//     ingredients: [],
//     cooking_notes: null, // Временное значение
//   };
// }