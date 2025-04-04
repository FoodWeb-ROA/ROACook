import { 
  Recipe, 
  RecipeIngredient, 
  RecipePreparation, 
  Ingredient, 
  Unit, 
  MenuSection,
  Preparation,
  PreparationIngredient
} from '../types';

import { Database } from '../data/database.types';

// Database types
type DbRecipe = Database['public']['Tables']['recipe']['Row'];
type DbMenuSection = Database['public']['Tables']['menu_section']['Row'];
type DbIngredient = Database['public']['Tables']['ingredients']['Row'];
type DbUnit = Database['public']['Tables']['units']['Row'];
type DbPreparation = Database['public']['Tables']['preparations']['Row'];
type DbRecipeIngredient = Database['public']['Tables']['recipe_ingredients']['Row'];
type DbRecipePreparation = Database['public']['Tables']['recipe_preparations']['Row'];
type DbPreparationIngredient = Database['public']['Tables']['preparation_ingredients']['Row'];

// Extended types for joined queries
type DbRecipeIngredientWithRelations = DbRecipeIngredient & {
  ingredients: DbIngredient;
  units: DbUnit;
};

type DbRecipePreparationWithRelations = DbRecipePreparation & {
  preparations: DbPreparation;
  units: DbUnit;
};

type DbPreparationWithRelations = DbPreparation & {
  preparation_ingredients?: DbPreparationIngredientWithRelations[];
};

type DbPreparationIngredientWithRelations = DbPreparationIngredient & {
  ingredients: DbIngredient;
  units: DbUnit;
};

/**
 * Transform a recipe ingredient from database format to UI format
 */
export function transformRecipeIngredient(dbIngredient: DbRecipeIngredientWithRelations): RecipeIngredient {
  // Add defensive checks
  if (!dbIngredient || !dbIngredient.ingredients) {
    console.warn('Missing ingredient data in transformRecipeIngredient', dbIngredient);
    return {
      recipe_id: dbIngredient?.recipe_id || '',
      ingredient_id: dbIngredient?.ingredient_id || '',
      ingredient: {
        ingredient_id: '',
        name: 'Unknown Ingredient'
      },
      amount: dbIngredient?.amount || 0,
      unit_id: dbIngredient?.unit_id || '',
      unit: {
        unit_id: '',
        unit_name: '',
        system: '',
        abbreviation: ''
      }
    };
  }

  return {
    recipe_id: dbIngredient.recipe_id,
    ingredient_id: dbIngredient.ingredient_id,
    ingredient: {
      ingredient_id: dbIngredient.ingredients.ingredient_id,
      name: dbIngredient.ingredients.name
    },
    amount: dbIngredient.amount,
    unit_id: dbIngredient.unit_id,
    unit: {
      unit_id: dbIngredient.units?.unit_id || '',
      unit_name: dbIngredient.units?.unit_name || '',
      system: dbIngredient.units?.system || '',
      abbreviation: dbIngredient.units?.abbreviation || dbIngredient.units?.unit_name || ''
    }
  };
}

/**
 * Transform a recipe preparation from database format to UI format
 */
export function transformRecipePreparation(dbPreparation: DbRecipePreparationWithRelations): RecipePreparation {
  return {
    recipe_id: dbPreparation.recipe_id,
    preparation_id: dbPreparation.preparation_id,
    preparation: {
      preparation_id: dbPreparation.preparations.preparation_id,
      preparation_name: dbPreparation.preparations.preparation_name,
      directions: dbPreparation.preparations.directions,
      prep_time: parseInt(dbPreparation.preparations.prep_time) || 0,
      total_time: parseInt(dbPreparation.preparations.total_time) || 0,
      rest_time: parseInt(dbPreparation.preparations.rest_time) || 0,
      servings: dbPreparation.preparations.servings,
      cooking_notes: dbPreparation.preparations.cooking_notes
    },
    amount: dbPreparation.amount,
    unit_id: dbPreparation.unit_id,
    unit: {
      unit_id: dbPreparation.units?.unit_id || '',
      unit_name: dbPreparation.units?.unit_name || '',
      system: dbPreparation.units?.system || '',
      abbreviation: dbPreparation.units?.abbreviation || dbPreparation.units?.unit_name || ''
    }
  };
}

/**
 * Transform a preparation from database format to UI format
 */
export function transformPreparation(dbPreparation: DbPreparationWithRelations): Preparation {
  if (!dbPreparation) return {
    preparation_id: '',
    preparation_name: '',
    directions: '',
    prep_time: 0,
    total_time: 0,
    rest_time: 0,
    servings: '',
    cooking_notes: '',
    ingredients: []
  };
  
  return {
    preparation_id: dbPreparation.preparation_id,
    preparation_name: dbPreparation.preparation_name,
    directions: dbPreparation.directions,
    prep_time: parseInt(dbPreparation.prep_time) || 0,
    total_time: parseInt(dbPreparation.total_time) || 0,
    rest_time: parseInt(dbPreparation.rest_time) || 0,
    servings: dbPreparation.servings,
    cooking_notes: dbPreparation.cooking_notes,
    ingredients: dbPreparation.preparation_ingredients?.map(transformPreparationIngredient) || []
  };
}

/**
 * Transform a preparation ingredient from database format to UI format
 */
export function transformPreparationIngredient(dbIngredient: DbPreparationIngredientWithRelations): PreparationIngredient {
  return {
    preparation_id: dbIngredient.preparation_id,
    ingredient_id: dbIngredient.ingredient_id,
    ingredient: {
      ingredient_id: dbIngredient.ingredients.ingredient_id,
      name: dbIngredient.ingredients.name
    },
    amount: dbIngredient.amount,
    unit_id: dbIngredient.unit_id,
    unit: {
      unit_id: dbIngredient.units?.unit_id || '',
      unit_name: dbIngredient.units?.unit_name || '',
      system: dbIngredient.units?.system || '',
      abbreviation: dbIngredient.units?.abbreviation || dbIngredient.units?.unit_name || ''
    }
  };
}

/**
 * Transform an ingredient from database format to UI format
 */
export function transformIngredient(dbIngredient: DbIngredient): Ingredient {
  if (!dbIngredient) return { ingredient_id: '', name: '' };
  
  return {
    ingredient_id: dbIngredient.ingredient_id,
    name: dbIngredient.name
  };
}

/**
 * Transform a unit from database format to UI format
 */
export function transformUnit(dbUnit: DbUnit): Unit {
  if (!dbUnit) return { unit_id: '', unit_name: '', system: '', abbreviation: '' };
  
  return {
    unit_id: dbUnit.unit_id,
    unit_name: dbUnit.unit_name,
    system: dbUnit.system,
    abbreviation: dbUnit.abbreviation || dbUnit.unit_name
  };
}

/**
 * Transform a menu section from database format to UI format
 */
export function transformMenuSection(dbMenuSection: DbMenuSection): MenuSection {
  if (!dbMenuSection) return { menu_section_id: '', name: '' };
  
  return {
    menu_section_id: dbMenuSection.menu_section_id,
    name: dbMenuSection.name
  };
}

/**
 * Transform a recipe from database format to UI format
 */
export function transformRecipe(
  dbRecipe: DbRecipe,
  dbMenuSection: DbMenuSection,
  dbRecipeIngredients: DbRecipeIngredientWithRelations[],
  dbRecipePreparations: DbRecipePreparationWithRelations[]
): Recipe {
  return {
    recipe_id: dbRecipe.recipe_id,
    recipe_name: dbRecipe.recipe_name,
    menu_section_id: dbRecipe.menu_section_id,
    directions: dbRecipe.directions,
    prep_time: parseInt(dbRecipe.prep_time) || 0,
    total_time: parseInt(dbRecipe.total_time) || 0,
    rest_time: parseInt(dbRecipe.rest_time) || 0,
    servings: dbRecipe.servings,
    cooking_notes: dbRecipe.cooking_notes,
    ingredients: dbRecipeIngredients.map(transformRecipeIngredient),
    preparations: dbRecipePreparations.map(transformRecipePreparation),
    isDeleted: false
  };
} 