'use strict';

import { supabase } from './supabaseClient';
import { Ingredient, Preparation, Dish } from '../types'; // Assuming types are defined here

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