import { useCallback } from 'react'
import { supabase } from '../data/supabaseClient'
import { appLogger } from '../services/AppLogService';

/**
 * Hook for looking up existing dishes and ingredients in the database
 */
export const useLookup = () => {
  /**
   * Look up dish by name
   * @param query Search term
   * @param exactMatch Whether to perform an exact match (for duplicate checking)
   * @returns Array of matching dishes and hasDuplicate flag if exactMatch is true
   */
  const lookupDish = useCallback(async (query: string, exactMatch: boolean = false) => {
    if (!query) return { dishes: [], hasDuplicate: false }
    
    try {
      const { data, error } = await supabase.functions.invoke('lookup-dish-by-name', {
        body: { query, exactMatch }
      })
      
      if (error) {
        appLogger.error('Error looking up dish:', error)
        return { dishes: [], hasDuplicate: false }
      }
      
      return { 
        dishes: data?.dishes || [],
        hasDuplicate: data?.hasDuplicate || false
      }
    } catch (err) {
      appLogger.error('Failed to lookup dish:', err)
      return { dishes: [], hasDuplicate: false }
    }
  }, [])

  /**
   * Check if a dish name already exists
   * @param dishName Name to check
   * @returns True if the dish already exists
   */
  const checkDishNameExists = useCallback(async (dishName: string) => {
    const { hasDuplicate } = await lookupDish(dishName, true)
    return hasDuplicate
  }, [lookupDish])

  /**
   * Look up ingredient by name
   * @param query Search term
   * @returns Array of matching ingredients
   */
  const lookupIngredient = useCallback(async (query: string) => {
    if (!query) return []
    
    try {
      const { data, error } = await supabase.functions.invoke('lookup-ingredient-by-name', {
        body: { query }
      })
      
      if (error) {
        appLogger.error('Error looking up ingredient:', error)
        return []
      }
      
      return data?.ingredients || []
    } catch (err) {
      appLogger.error('Failed to lookup ingredient:', err)
      return []
    }
  }, [])

  /**
   * Check if an ingredient with the given name already exists
   */
  const checkIngredientNameExists = async (name: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('ingredient_id')
        .ilike('name', name.trim())
        .limit(1);
      
      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      appLogger.error('Error checking ingredient name existence:', error);
      throw error;
    }
  };

  /**
   * Check if a preparation with the given name already exists
   * Since preparations are also ingredients, this uses the ingredients table
   */
  const checkPreparationNameExists = async (name: string): Promise<boolean> => {
    try {
      // First check if ingredient exists
      const nameExists = await checkIngredientNameExists(name);
      if (nameExists) return true;
      
      return false;
    } catch (error) {
      appLogger.error('Error checking preparation name existence:', error);
      throw error;
    }
  };

  return { lookupDish, lookupIngredient, checkDishNameExists, checkIngredientNameExists, checkPreparationNameExists }
} 