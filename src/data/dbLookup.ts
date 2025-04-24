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
 * NOTE: For better fuzzy matching, consider using pg_trgm functions via Supabase RPC.
 */
export const findCloseIngredient = async (
    name: string,
    limit: number = 10
): Promise<(Ingredient & { isPreparation?: boolean })[]> => {
    if (!name?.trim()) return [];
    const searchTerm = `%${name.trim()}%`;

    try {
        // Query ingredients table with a join to preparations to check if it's a prep
        const { data, error } = await supabase
            .from('ingredients')
            .select(`
                ingredient_id,
                name,
                unit_id,
                amount,
                item,
                synonyms,
                cooking_notes,
                storage_location,
                preparations ( preparation_id ) 
            `)
            .ilike('name', searchTerm)
            .limit(limit);

        if (error) {
            console.error('Error finding close ingredients:', error);
            throw error;
        }

        // Map results and add the isPreparation flag
        const results = data?.map((ing: any) => ({
            ...(ing as Ingredient),
            isPreparation: !!ing.preparations, // Check if the join returned a preparation_id
        })) || [];

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
    // Preparations are also in the ingredients table, so we check there.
    // We also need to ensure the found ingredient IS a preparation.
    const { data, error } = await supabase
      .from('ingredients')
      .select(`
        ingredient_id,
        preparations ( preparation_id )
      `)
      .ilike('name', name.trim())
      .not('preparations', 'is', null) // Ensure it has a corresponding row in preparations
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error checking preparation name:', error);
        throw error;
    }

    // Ensure the join confirmed it's a preparation before returning the ID
    return data?.preparations ? data.ingredient_id : null;

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