import { Database } from './data/database.types';

// Re-exporting base types or defining custom app types
export type Unit = Database['public']['Tables']['units']['Row'];

// Update Ingredient type to include optional isPreparation flag and base_unit details
export type Ingredient = Database['public']['Tables']['ingredients']['Row'] & {
    isPreparation?: boolean; // Added by useIngredients hook
    base_unit?: Unit | null; // Potentially added by useIngredients hook
    item?: string | null; // Added: Item description for counts
};

export type MenuSection = Database['public']['Tables']['menu_section']['Row'];

// Define Preparation type based on DB + transformed structure
export type Preparation = {
    preparation_id: string;
    name: string;
    directions: string | null;
    total_time: number | null; // Re-added
    yield_unit: Unit | null;
    yield_amount: number | null; // Add yield amount
    reference_ingredient: string | null; // New field for reference ingredient
    ingredients: PreparationIngredient[];
    cooking_notes: string | null;
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
    item?: string | null; // <-- ADDED: Item description (e.g., "large", "medium")
    isPreparation: boolean;
    // Include details based on whether it's a raw ingredient or a preparation
    preparationDetails: (Preparation & { ingredients: PreparationIngredient[] }) | null;
    rawIngredientDetails: (Ingredient & { base_unit: Unit | null; item?: string | null }) | null;
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
    serving_item?: string | null; // Added: Item description for serving unit 'x' (e.g., "bowl", "portion")
    num_servings: number | null; // New field replacing total_yield
    components: DishComponent[]; // Array of components
    cooking_notes: string | null;
    imageUrl?: string; // Optional image URL
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

// --- Recipe Kind ---
export type RecipeKind = 'dish' | 'preparation';

// --- Types related to Recipe Parser Output ---

// Interface for a component returned by the parser (can be raw or prep)
// Note: Units are strings initially, need mapping/validation later.
// Updated to reflect the actual parser output: 'components'
export interface ParsedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  item?: string | null; // ADDED: Item description for counts (e.g., "cloves" for unit "x")
  ingredient_type?: "RawIngredient" | "Preparation";
  components?: ParsedIngredient[]; // For nested preparations
  instructions?: string[]; // For preparation-specific instructions
  reference_ingredient?: string | null; // For preparations based on sysprompt
}

// Interface for the overall Recipe structure returned by the parser
// Updated to match the actual parser output keys more closely
export interface ParsedRecipe {
  recipe_name: string; 
  language?: string; // ADDED: To match sysprompt requirement
  components: ParsedIngredient[]; 
  instructions: string[]; 
  total_time?: number | null; 
  num_servings: number;       // Total portions produced (Required now for scaling)
  serving_size?: number | null;       // Size per portion
  serving_unit?: string | null;       // Unit for serving_size
  serving_item?: string | null;       // Optional descriptor when unit is "x"
  cook_notes?: string | null; 
}

// --- End Recipe Parser Types ---

export type ComponentInput = {
    key: string; // Unique key for FlatList/mapping
    ingredient_id: string;
    name: string; // Store name for display convenience
    amount: string; // Keep as string for input field
    unit_id: string | null;
    isPreparation: boolean;
    originalPrep?: ParsedIngredient; // keep full parsed preparation when confirming
    subIngredients?: ParsedIngredient[] | null; // Store parsed sub-ingredients
    item?: string | null; // ADDED: To store item description (e.g., "cloves")
    reference_ingredient?: string | null; // Store reference ingredient for preparations
}; 