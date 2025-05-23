'use strict';

import { supabase } from './supabaseClient';
import { Ingredient } from '../types';
import { DbUnit, FetchedIngredientDetail, FetchedPreparationDataCombined, FetchedPreparationDetail, FetchedPreparationIngredient, transformPreparation, transformPreparationIngredient, transformUnit } from '../utils/transforms';
import { appLogger } from '../services/AppLogService';

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
      appLogger.error('Error checking ingredient name:', error);
      throw error; // Re-throw unexpected errors
    }
    return data?.ingredient_id || null;
  } catch (error) {
    appLogger.error('Supabase call failed (checkIngredientNameExists):', error);
    return null; // Return null on failure to avoid blocking UX
  }
};

/**
 * Finds ingredients with names similar to the query (case-insensitive prefix/suffix match).
 * Also flags if the ingredient is a preparation.
 */
export interface SlimIngredient {
  ingredient_id: string;
  name: string;
  isPreparation: boolean;
}

export const findCloseIngredient = async (
  name: string,
  limit: number = 10
): Promise<SlimIngredient[]> => {
  if (!name?.trim()) return [];
  const searchTerm = `%${name.trim()}%`;

  try {
    // Step 1: Find ingredients matching the name
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('ingredients')
      .select(`
        ingredient_id,
        name
      `)
      .ilike('name', searchTerm)
      .limit(limit);

    if (ingredientsError) {
      appLogger.error('Error finding close ingredients (step 1):', ingredientsError);
      throw ingredientsError;
    }

    if (!ingredientsData || ingredientsData.length === 0) {
      return [];
    }

    // Step 2: Check which of these ingredients are also preparations
    const ingredientIds = ingredientsData.map((ing: any) => ing.ingredient_id);
    const { data: preparationsData, error: preparationsError } = await supabase
      .from('preparations')
      .select('preparation_id')
      .in('preparation_id', ingredientIds);

    if (preparationsError) {
      appLogger.error('Error checking preparations link (step 2):', preparationsError);
      // Decide how to handle this - return partial results or throw?
      // For now, let's return ingredients without the isPreparation flag set correctly.
      return ingredientsData.map(ing => ({ ...ing, isPreparation: false } as any));
    }

    const preparationIds = new Set(preparationsData?.map(p => p.preparation_id) || []);

    // Step 3: Combine results
    const results: SlimIngredient[] = ingredientsData.map((ing: any) => ({
      ingredient_id: ing.ingredient_id,
      name: ing.name,
      isPreparation: preparationIds.has(ing.ingredient_id),
    }));

    return results;

  } catch (error) {
    appLogger.error('Supabase call failed (findCloseIngredient):', error);
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
      appLogger.error('Error finding preparation by fingerprint:', error);
      throw error;
    }
    return data?.preparation_id || null;
  } catch (error) {
    appLogger.error('Supabase call failed (findPreparationByFingerprint):', error);
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
      appLogger.error('Error checking ingredient for preparation name:', ingErr);
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
      appLogger.error('Error checking preparations link:', prepErr);
      throw prepErr;
    }

    return prep ? ing.ingredient_id : null;

  } catch (error) {
    appLogger.error('Supabase call failed (checkPreparationNameExists):', error);
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
      appLogger.error('Error finding dish by name:', error);
      throw error;
    }
    return data?.dish_id || null;
  } catch (error) {
    appLogger.error('Supabase call failed (findDishByName):', error);
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
        ingredient:ingredients!preparations_preparation_id_fkey (
          *
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
    const prepBaseDetails = prepJoinData as (FetchedPreparationDetail & { cooking_notes: string | null }) | null;

    if (!prepBaseDetails || !ingredientDetails) {
      throw new Error(`Preparation ${preparationId} or its linked ingredient not found.`);
    }

    // Construct the combined data for transformation
    const combinedDataForTransform: FetchedPreparationDataCombined = {
      // Fields from FetchedIngredientDetail (ingredient part)
      ingredient_id: ingredientDetails.ingredient_id,
      name: ingredientDetails.name,
      unit_id: (ingredientDetails as any).unit_id ?? null,    
      deleted: ingredientDetails.deleted,
      kitchen_id: ingredientDetails.kitchen_id || '',

      // Fields from FetchedPreparationDetail (preparation part, via prepBaseDetails)
      preparation_id: prepBaseDetails.preparation_id,
      directions: prepBaseDetails.directions,
      total_time: prepBaseDetails.total_time,
      cooking_notes: prepBaseDetails.cooking_notes,   // Sourced from preparation
      fingerprint: prepBaseDetails.fingerprint,
      // Fields explicitly required by FetchedPreparationDataCombined that might overlap or need specific sourcing
      amount: ingredientDetails.amount ?? 0,          // This is the YIELD AMOUNT from the ingredient table
      created_at: ingredientDetails.created_at ?? null, // from ingredient part
      updated_at: ingredientDetails.updated_at ?? null, // from ingredient part
    };

    // Transform the base preparation details
    const transformedPrep = transformPreparation(combinedDataForTransform);

    // Fetch sub-ingredients for the preparation
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('preparation_components')
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
        appLogger.warn(`[fetchPreparationDetailsFromDB] Failed to check for nested preparations:`, prepCheckError);
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
    appLogger.error(`Error fetching preparation ${preparationId}:`, error);
    return { preparation: null, ingredients: [] };
  }
};