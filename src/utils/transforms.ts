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

// Base Database types (Keep private unless needed elsewhere)
type DbDish = Database['public']['Tables']['dishes']['Row'];
export type DbMenuSection = Database['public']['Tables']['menu_section']['Row']; // Export needed for hook
type DbIngredient = Database['public']['Tables']['ingredients']['Row'];
export type DbUnit = Database['public']['Tables']['units']['Row']; // Export needed for hook
type DbPreparation = Database['public']['Tables']['preparations']['Row'];
export type DbDishComponent = Database['public']['Tables']['dish_components']['Row']; // Export needed for hook
type DbPreparationIngredient = Database['public']['Tables']['preparation_ingredients']['Row'];

// --- Export TYPES REPRESENTING DATA STRUCTURES AS FETCHED in the refactored hooks ---

// Type for the initial dish fetch in useDishDetail
export type FetchedDishData = DbDish & {
  menu_section: DbMenuSection | null; // Joined data
  serving_unit: DbUnit | null;       // Joined data
};

// Type for the base components fetched in useDishDetail
export type FetchedBaseComponent = Pick<DbDishComponent, 'ingredient_id' | 'unit_id' | 'amount'>;

// Type for ingredient details fetched separately
export type FetchedIngredientDetail = DbIngredient & { 
    base_unit: DbUnit | null; // Joined base unit
};

// Type for preparation details fetched separately
export type FetchedPreparationDetail = DbPreparation & { 
    yield_unit: DbUnit | null; // Joined yield unit
    reference_ingredient?: string | null; // Add reference_ingredient property as optional
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
export type FetchedPreparationDataCombined = FetchedIngredientDetail & FetchedPreparationDetail & { amount: number };

// -- Export Transformation Functions --

/**
 * Transform a dish component from the ASSEMBLED data in useDishDetail hook
 */
export function transformDishComponent(assembledData: AssembledComponentData): DishComponent {
  const { baseComponent, ingredient, preparation, componentUnit, prepIngredients, dish_id } = assembledData;

  // Check if essential ingredient info is present
  if (!ingredient) {
    console.warn('Missing ingredient details for component', baseComponent);
    return { 
        dish_id: dish_id,
        ingredient_id: baseComponent.ingredient_id || '',
        name: 'Unknown Component',
        amount: baseComponent.amount || 0,
        unit: transformUnit(componentUnit), // Use the unit fetched for the component instance
        isPreparation: false,
        preparationDetails: null,
        rawIngredientDetails: null
    };
  }

  const isPreparation = !!preparation; // Check if preparation details exist
  let finalPrepDetails: (Preparation & { ingredients: PreparationIngredient[] }) | null = null;
  let finalRawIngredientDetails: (Ingredient & { base_unit: Unit | null }) | null = null;

  if (isPreparation && preparation) {
      // Transform the combined ingredient + preparation data
      const transformedPrep = transformPreparation({
          ...ingredient, // Base info like name, cooking_notes
          ...preparation // Prep specific info like directions, time, yield_unit
      });
      // Assign the already fetched & transformed ingredients from the hook
      transformedPrep.ingredients = prepIngredients || [];
      finalPrepDetails = transformedPrep as (Preparation & { ingredients: PreparationIngredient[] }); // Cast needed if transformPreparation return type is just Preparation
  } else {
      // Transform raw ingredient details
      finalRawIngredientDetails = {
          ...transformIngredient(ingredient),
          base_unit: transformUnit(ingredient.base_unit)
      };
  }

  return {
    dish_id: dish_id,
    ingredient_id: ingredient.ingredient_id,
    name: ingredient.name,
    amount: baseComponent.amount || 0,
    unit: transformUnit(componentUnit), // Unit specifically for this component usage
    isPreparation: isPreparation,
    preparationDetails: finalPrepDetails, 
    rawIngredientDetails: finalRawIngredientDetails
  };
}

/**
 * Transform a preparation from the COMBINED ingredient + preparation data 
 * (Now includes yield amount from ingredient table)
 */
export function transformPreparation(combinedData: FetchedPreparationDataCombined | null): Preparation { 
  if (!combinedData) return { 
      preparation_id: '',
      name: 'Unknown Preparation',
      directions: null,
      total_time: null,
      yield_unit: transformUnit(null),
      yield_amount: null, // Add default yield_amount
      reference_ingredient: null, // Add default reference_ingredient
      ingredients: [],
      cooking_notes: null 
    };

  return {
    preparation_id: combinedData.preparation_id, 
    name: combinedData.name, 
    directions: combinedData.directions || '', 
    total_time: combinedData.total_time || 0, 
    yield_unit: transformUnit(combinedData.yield_unit), 
    yield_amount: combinedData.amount, // Get yield amount from ingredient data
    reference_ingredient: (combinedData as any).reference_ingredient || null, // Access reference_ingredient with type assertion
    ingredients: [], 
    cooking_notes: combinedData.cooking_notes, 
  };
}

/**
 * Transform a preparation ingredient from the fetched data structure
 */
export function transformPreparationIngredient(dbIngredient: FetchedPreparationIngredient): PreparationIngredient {
  if (!dbIngredient || !dbIngredient.ingredient) {
     // ... (keep warning and default return)
     return { preparation_id: '', ingredient_id: '', name: '', amount: 0, unit: transformUnit(null) };
  }
  return {
    preparation_id: dbIngredient.preparation_id,
    ingredient_id: dbIngredient.ingredient.ingredient_id,
    name: dbIngredient.ingredient.name,
    amount: dbIngredient.amount || 0,
    unit: transformUnit(dbIngredient.unit)
  };
}

/**
 * Transform an ingredient from the fetched data structure
 */
export function transformIngredient(dbIngredient: FetchedIngredientDetail | DbIngredient | null): Ingredient {
  // Return a default structure matching Ingredient type if input is null
  if (!dbIngredient) return { 
      ingredient_id: '', 
      name: 'Unknown', 
      cooking_notes: null, 
      storage_location: null,
      amount: 0,          // Add default required fields
      created_at: '',    // Use appropriate default (e.g., empty string, epoch date)
      synonyms: null,
      unit_id: '',
      updated_at: '',
      isPreparation: false, // Add optional fields with defaults
      base_unit: null
    };
  
  // Return all properties from dbIngredient, ensuring required fields exist
  // The `Ingredient` type in types.ts should closely match DbIngredient + optional fields
  return {
    ...dbIngredient, // Spread all properties from the DB object
    // Ensure optional fields added by hooks are handled or defaulted if necessary
    // isPreparation: (dbIngredient as any).isPreparation ?? false, // Example if isPreparation was added before transform
    // base_unit: transformUnit((dbIngredient as FetchedIngredientDetail).base_unit) // Example if transforming nested unit
  };
}

/**
 * Transform a unit from the fetched data structure
 */
export function transformUnit(dbUnit: DbUnit | null | undefined): Unit { // Allow undefined
  if (!dbUnit) return { unit_id: '', unit_name: 'N/A', system: null, abbreviation: '' };
  
  return {
    unit_id: dbUnit.unit_id,
    unit_name: dbUnit.unit_name,
    system: dbUnit.system,
    abbreviation: dbUnit.abbreviation || dbUnit.unit_name
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
      kitchen_id: '' // Add default kitchen_id
    };
  
  // Include kitchen_id in the returned object
  return {
    menu_section_id: dbMenuSection.menu_section_id,
    name: dbMenuSection.name,
    kitchen_id: dbMenuSection.kitchen_id // Include kitchen_id
  };
}

/**
 * Transform a dish from the fetched data structure
 */
export function transformDish(dbDish: FetchedDishData | null): Dish {
 if (!dbDish) {
    console.error("transformDish received null input");
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