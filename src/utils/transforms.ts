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
 * passed from useDishDetail hook (or potentially usePreparationDetail)
 */
export function transformPreparation(combinedData: FetchedIngredientDetail & FetchedPreparationDetail): Preparation {
  // This function now expects the merged data 
  if (!combinedData) return { 
      preparation_id: '',
      name: 'Unknown Preparation',
      directions: null,
      total_time: null,
      yield_unit: transformUnit(null),
      ingredients: [],
      cooking_notes: null 
    }; // Add default structure

  return {
    preparation_id: combinedData.preparation_id, // from FetchedPreparationDetail part
    name: combinedData.name, // from FetchedIngredientDetail part
    directions: combinedData.directions || '', // from FetchedPreparationDetail part
    total_time: combinedData.total_time || 0, // from FetchedPreparationDetail part
    yield_unit: transformUnit(combinedData.yield_unit), // from FetchedPreparationDetail part
    ingredients: [], // Placeholder - Ingredients added in the hook
    cooking_notes: combinedData.cooking_notes, // from FetchedIngredientDetail part
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
  if (!dbIngredient) return { ingredient_id: '', name: 'Unknown', cooking_notes: null, storage_location: null };
  
  return {
    ingredient_id: dbIngredient.ingredient_id,
    name: dbIngredient.name,
    cooking_notes: dbIngredient.cooking_notes,
    storage_location: dbIngredient.storage_location,
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
export function transformMenuSection(dbMenuSection: DbMenuSection | null): MenuSection { // Input is simpler now
  if (!dbMenuSection) return { menu_section_id: '', name: 'Uncategorized' };
  
  return {
    menu_section_id: dbMenuSection.menu_section_id,
    name: dbMenuSection.name
  };
}

/**
 * Transform a dish from the fetched data structure
 */
export function transformDish(dbDish: FetchedDishData | null): Dish {
 if (!dbDish) {
    // ... (keep error and default return)
    return { dish_id: '', dish_name: 'Unknown Dish', menu_section: transformMenuSection(null), directions: null, total_time: null, serving_size: null, serving_unit: null, components: [], cooking_notes: null };
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
    cooking_notes: dbDish.cooking_notes
  };
} 