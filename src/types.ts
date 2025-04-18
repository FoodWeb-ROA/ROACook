import { Database } from './data/database.types';

// Re-exporting base types or defining custom app types
export type Unit = Database['public']['Tables']['units']['Row'];

// Update Ingredient type to include optional isPreparation flag and base_unit details
export type Ingredient = Database['public']['Tables']['ingredients']['Row'] & {
    isPreparation?: boolean; // Added by useIngredients hook
    base_unit?: Unit | null; // Potentially added by useIngredients hook
};

export type MenuSection = Database['public']['Tables']['menu_section']['Row'];

// Define Preparation type based on DB + transformed structure
export type Preparation = {
    preparation_id: string;
    name: string;
    directions: string | null;
    total_time: number | null;
    yield_unit: Unit | null;
    yield_amount: number | null; // Add yield amount
    ingredients: PreparationIngredient[];
    cooking_notes: string | null;
    // Add other relevant fields if needed
};

// Define PreparationIngredient based on transformed structure
export type PreparationIngredient = {
    preparation_id: string; 
    ingredient_id: string;
    name: string; // Ingredient name
    amount: number | null;
    unit: Unit | null;
    // Add other relevant fields if needed
};

// Define DishComponent based on transformed structure
export type DishComponent = {
    dish_id: string;
    ingredient_id: string;
    name: string; // Name of the component (ingredient or preparation)
    amount: number | null;
    unit: Unit | null;
    isPreparation: boolean;
    // Include details based on whether it's a raw ingredient or a preparation
    preparationDetails: (Preparation & { ingredients: PreparationIngredient[] }) | null;
    rawIngredientDetails: (Ingredient & { base_unit: Unit | null }) | null;
    // Add imageUrl or other specific fields?
};

// Define Dish type based on DB + transformed structure
export type Dish = {
    dish_id: string;
    dish_name: string;
    menu_section: MenuSection | null; // Transformed menu section
    directions: string | null;
    total_time: string | null; // Keep as string for now (interval type)
    serving_size: number | null;
    serving_unit: Unit | null; // Transformed unit
    components: DishComponent[]; // Array of components
    cooking_notes: string | null;
    imageUrl?: string; // Optional image URL
    // Add other relevant fields
};

// Re-export Category if it's just MenuSection
export type Category = MenuSection;

// Measurement Unit Type (as defined locally before)
export type MeasurementUnit = 
  | 'g' | 'kg' 
  | 'ml' | 'l' 
  | 'tsp' | 'tbsp' 
  | 'oz' | 'lb' 
  | 'cup'
  | 'count'
  | 'pinch';

export type Kitchen = {
  kitchen_id: string;
  name: string;
  location: string;
  members?: KitchenMember[];
};

export type KitchenMember = {
  kitchen_id: string;
  user_id: string;
  role: string;
};

export type User = {
  id: number;
  uuid: string;
  username: string;
  email: string;
  user_type_id: number;
  created_at: string;
  updated_at: string;
};

export type UserType = {
  id: number;
  name: string;
};

// --- Types related to Recipe Parser Output ---

// Interface for a component returned by the parser (can be raw or prep)
// Note: Units are strings initially, need mapping/validation later.
export interface ParsedComponent {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  // Fields specific to Preparations identified by the parser
  isPreparation?: boolean; // Flag to distinguish
  ingredients?: ParsedComponent[]; // Nested components if it's a prep
  directions?: string[]; // Directions if it's a prep
  yield_quantity?: number | null;
  yield_unit?: string | null;
  total_time_minutes?: number | null; // Prep-specific time
}

// Interface for the overall Recipe structure returned by the parser
export interface ParsedRecipe {
  name: string;
  description?: string | null;
  category?: string | null;
  components: ParsedComponent[]; // List of raw ingredients or preparations
  directions: string[];
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null; // Might be redundant if prep/cook exist
  servings?: number | null;
  serving_unit?: string | null;
  notes?: string | null;
}

// --- End Recipe Parser Types --- 