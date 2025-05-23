import { 
  Dish, 
  DishComponent, 
  Ingredient, 
  Unit, 
  MenuSection,
  Preparation,
  PreparationIngredient
} from '../types';

import { Database } from '../data/database.types';
import { appLogger } from '../services/AppLogService';

// Base Database types (Keep private unless needed elsewhere)
type DbDish = Database['public']['Tables']['dishes']['Row'];
export type DbMenuSection = Database['public']['Tables']['menu_section']['Row']; // Export needed for hook
type DbIngredient = Database['public']['Tables']['ingredients']['Row'];
export type DbUnit = Database['public']['Tables']['units']['Row']; // Export needed for hook
type DbPreparation = Database['public']['Tables']['preparations']['Row'];
export type DbDishComponent = Database['public']['Tables']['dish_components']['Row']; // Export needed for hook
type DbPreparationIngredient = Database['public']['Tables']['preparation_components']['Row'];

// --- Export TYPES REPRESENTING DATA STRUCTURES AS FETCHED in the refactored hooks ---

// Type for the initial dish fetch in useDishDetail
export type FetchedDishData = DbDish & {
  menu_section: DbMenuSection | null; // Joined data
  serving_unit: DbUnit | null;       // Joined data
};

// Type for the base components fetched in useDishDetail
export type FetchedBaseComponent = Pick<DbDishComponent, 'ingredient_id' | 'unit_id' | 'amount' | 'piece_type'>;

// Type for ingredient details fetched separately
export type FetchedIngredientDetail = DbIngredient;

// Type for preparation details fetched separately
export type FetchedPreparationDetail = DbPreparation & { 
    cooking_notes: string | null; // cooking_notes will now be part of DbPreparation
};

// Type for preparation ingredients fetched separately
export type FetchedPreparationIngredient = DbPreparationIngredient & {
    unit: DbUnit | null;
    ingredient: DbIngredient | null;
};

// Type for the assembled component data *before* final transformation in useDishDetail hook
export type AssembledComponentData = {
    dish_id: string;
    baseComponent: FetchedBaseComponent;
    ingredient: FetchedIngredientDetail | undefined;
    preparation: FetchedPreparationDetail | undefined;
    componentUnit: DbUnit | undefined;
    prepIngredients: PreparationIngredient[] | undefined; // Already transformed in the hook
};

// Update combined data type for transformPreparation input
// Allow nulls for fields that can be null in DbIngredient/DbPreparation
export type FetchedPreparationDataCombined = 
    Omit<FetchedIngredientDetail, 'created_at' | 'updated_at' | 'cooking_notes'> & // cooking_notes removed from ingredient part
    Omit<FetchedPreparationDetail, 'created_at'> & // cooking_notes will be inherited from FetchedPreparationDetail (DbPreparation)
    { 
        // Add missing fields from FetchedPreparationDetail
        amount: number;
        created_at: string | null; 
        updated_at: string | null;
    };

// -- Export Transformation Functions --

/**
 * Transform a dish component from the ASSEMBLED data in useDishDetail hook
 */
export function transformDishComponent(assembledData: AssembledComponentData): DishComponent {
  const { baseComponent, ingredient, preparation, componentUnit, prepIngredients, dish_id } = assembledData;

  // Check if essential ingredient info is present
  if (!ingredient) {
    appLogger.warn('Missing ingredient details for component', baseComponent);
    return { 
        dish_id: dish_id,
        ingredient_id: baseComponent.ingredient_id || '',
        name: 'Unknown Component',
        amount: baseComponent.amount || 0,
        unit: transformUnit(componentUnit), // Use the unit fetched for the component instance
        item: (baseComponent as any).piece_type || null, // Map piece_type to item, handle potential undefined
        isPreparation: false,
        preparationDetails: null,
        rawIngredientDetails: null
    };
  }

  const isPreparation = !!preparation; // Check if preparation details exist
  let finalPrepDetails: (Preparation & { ingredients: PreparationIngredient[] }) | null = null;
  let finalRawIngredientDetails: Ingredient | null = null;

  if (isPreparation && preparation) {
      // --- MODIFIED: Construct finalPrepDetails directly ---
      // Use the details from the already fetched 'preparation' object
      // and the already transformed 'prepIngredients' list.
      finalPrepDetails = {
          preparation_id: preparation.preparation_id,
          name: ingredient.name, // Name comes from the base ingredient row linked to the prep
          directions: preparation.directions || null,
          total_time: preparation.total_time || null,
          // Use the already transformed ingredients list passed in
          ingredients: prepIngredients || [], 
          cooking_notes: preparation.cooking_notes ?? null, // Notes now come from the preparation itself
      };
      // --- END MODIFICATION ---
      // --- ADD LOGGING: Final Prep Details ---
      appLogger.log(`[transformDishComponent] Final prepDetails for ${preparation.preparation_id}:`, JSON.stringify(finalPrepDetails, null, 2));
      // --- END LOGGING ---
  } else {
      // Transform raw ingredient details
      finalRawIngredientDetails = {
          ...transformIngredient(ingredient),
      };
  }

  return {
    dish_id: dish_id,
    ingredient_id: ingredient.ingredient_id,
    name: ingredient.name,
    amount: baseComponent.amount || 0,
    unit: transformUnit(componentUnit), // Unit specifically for this component usage
    item: (baseComponent as any).piece_type || null, // Map piece_type to item, handle potential undefined
    isPreparation: isPreparation,
    preparationDetails: finalPrepDetails, 
    rawIngredientDetails: finalRawIngredientDetails
  };
}

/**
 * Transform a preparation from the COMBINED ingredient + preparation data 
 */
export function transformPreparation(combinedData: FetchedPreparationDataCombined | null): Preparation { 
  // --- ADD LOGGING: Input data ---
  appLogger.log('[transformPreparation] Input combinedData:', JSON.stringify(combinedData, null, 2));
  // --- END LOGGING ---

  if (!combinedData) {
      // ... (null handling - unchanged) ...
      return { 
          preparation_id: '',
          name: 'Unknown Preparation',
          directions: null,
          total_time: null,
          ingredients: [],
          cooking_notes: null 
        };
  }

  // --- ADDED: Robust parsing for directions --- 
  let processedDirections: string | null = null;
  if (typeof combinedData.directions === 'string' && combinedData.directions.startsWith('{') && combinedData.directions.endsWith('}')) {
      // Looks like the PostgreSQL array string format "{"Step 1","Step 2"}"
      processedDirections = combinedData.directions
          .slice(1, -1) // Remove curly braces
          .split('","') // Split by the comma and quotes separator
          .map(step => step.replace(/^"|"$/g, '')) // Remove leading/trailing quotes from each step
          .join('\n'); // Join with newlines
  } else if (Array.isArray(combinedData.directions)) {
      // Handle if it's somehow already a JS array
      processedDirections = combinedData.directions.join('\n');
  } else {
      // Assume it's either null or a pre-formatted string
      processedDirections = combinedData.directions || null;
  }
  // --- END Parsing ---

  const result = {
    preparation_id: combinedData.preparation_id, 
    name: combinedData.name, 
    directions: processedDirections, 
    total_time: combinedData.total_time || null, // Keep null if it is null 
    ingredients: [], 
    cooking_notes: combinedData.cooking_notes ?? null, // cooking_notes will now be directly from combinedData (originating from DbPreparation)
  };

  // --- ADD LOGGING: Output data ---
  appLogger.log('[transformPreparation] Output Preparation object:', JSON.stringify(result, null, 2));
  // --- END LOGGING ---

  return result;
}

/**
 * Transform a preparation ingredient from the fetched data structure
 */
export function transformPreparationIngredient(dbIngredient: FetchedPreparationIngredient): PreparationIngredient {
  if (!dbIngredient || !dbIngredient.ingredient) {
     // Return default matching PreparationIngredient type
     return { 
         preparation_id: dbIngredient?.preparation_id || '', // Use optional chaining 
         ingredient_id: '', 
         name: 'Unknown', 
         amount: 0, 
         unit: transformUnit(null) 
        };
  }
  return {
    preparation_id: dbIngredient.preparation_id,
    ingredient_id: dbIngredient.ingredient.ingredient_id,
    name: dbIngredient.ingredient.name,
    amount: dbIngredient.amount ?? 0, // Use nullish coalescing
    unit: transformUnit(dbIngredient.unit)
  };
}

/**
 * Transform an ingredient from the fetched data structure
 */
export function transformIngredient(dbIngredient: FetchedIngredientDetail | DbIngredient | null): Ingredient {
  if (!dbIngredient) return { 
      ingredient_id: '', 
      name: 'Unknown',         
      created_at: '',    
      unit_id: '',
      updated_at: '',
      deleted: false, 
      kitchen_id: '', 
      isPreparation: false, 
    };
  
  // Construct the Ingredient object, providing defaults for required fields if null/undefined
  const result: Ingredient = {
    ingredient_id: dbIngredient.ingredient_id, 
    name: dbIngredient.name, 
    created_at: dbIngredient.created_at || '', // Default to empty string
    deleted: dbIngredient.deleted ?? false, // Default to false
    kitchen_id: dbIngredient.kitchen_id || '', // Default to empty string
    unit_id: dbIngredient.unit_id || '', // Default to empty string
    updated_at: dbIngredient.updated_at || '', // Default to empty string 
    // isPreparation should be set based on context where this is called, not here
  };

  return result;
}

/**
 * Transform a unit from the fetched data structure
 */
export function transformUnit(dbUnit: DbUnit | null | undefined): Unit {
    if (!dbUnit) {
        return {
            unit_id: '',
            unit_name: 'N/A',
            system: null,
            abbreviation: 'N/A',
            measurement_type: null,
        };
    }
    return {
        unit_id: dbUnit.unit_id,
        unit_name: dbUnit.unit_name,
        system: dbUnit.system,
        abbreviation: dbUnit.abbreviation,
        measurement_type: dbUnit.measurement_type ?? null,
    };
}

/**
 * Transform a menu section from the fetched data structure
 */
export function transformMenuSection(dbMenuSection: DbMenuSection | null): MenuSection { 
  // Add kitchen_id to the default return object
  if (!dbMenuSection) return { 
      menu_section_id: '', 
      name: 'Uncategorized', 
      kitchen_id: '' 
    };
  
  // Include kitchen_id in the returned object
  return {
    menu_section_id: dbMenuSection.menu_section_id,
    name: dbMenuSection.name,
    kitchen_id: dbMenuSection.kitchen_id 
  };
}

/**
 * Transform a dish from the fetched data structure
 */
export function transformDish(dbDish: FetchedDishData | null): Dish {
 if (!dbDish) {
    appLogger.error("transformDish received null input");
    return {
      dish_id: '',
      dish_name: 'Unknown Dish',
      menu_section: transformMenuSection(null),
      directions: null,
      total_time: null,
      serving_size: null,
      serving_unit: null,
      num_servings: null,
      components: [],
      cooking_notes: null,
    };
 }
  
  // Safely access potentially null related data
  const menuSection = dbDish.menu_section ? transformMenuSection(dbDish.menu_section) : transformMenuSection(null);
  const servingUnit = dbDish.serving_unit ? transformUnit(dbDish.serving_unit) : transformUnit(null);

  return {
    dish_id: dbDish.dish_id,
    dish_name: dbDish.dish_name,
    menu_section: menuSection,
    directions: dbDish.directions,
    // Handle total_time (interval type from DB) - needs specific handling if not string
    total_time: typeof dbDish.total_time === 'string' ? dbDish.total_time : null, // Basic check
    serving_size: dbDish.serving_size,
    serving_unit: servingUnit,
    components: [], // Components are handled by the hook
    cooking_notes: dbDish.cooking_notes,
    num_servings: (dbDish as any).num_servings ?? null,
  };
} 
