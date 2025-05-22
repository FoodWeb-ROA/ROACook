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
    yield: number; // Changed from number | null
    fingerprint?: string | null; // ADDED: Fingerprint for duplicate detection
    ingredients: PreparationIngredient[];
    cooking_notes: string | null;

    amount_unit_id?: string | null;
    yield_unit_id?: string | null;
    // ingredient_id: string;
    created_at?: string | null;
    updated_at?: string | null;
};

// export type Preparation = {
//     preparation_id: string;
//     directions: string | null;
//     amount_unit_id?: string | null;
//     total_time: number | null; // Re-added
//     fingerprint?: string | null; // ADDED: Fingerprint for duplicate detection
//     created_at?: string | null;
//     updated_at?: string | null;
//     deleted: boolean;
// };

// Define PreparationIngredient based on transformed structure
export type PreparationIngredient = {
    preparation_id: string; 
    ingredient_id: string;
    name: string; // Ingredient name
    amount: number | null;
    unit: Unit | null;
    isPreparation?: boolean; // Added by usePreparationDetail hook
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
    // Optional: carry scaling multiplier for preparation amount when used in parent recipe
    prepScaleMultiplier?: number;
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

// Type for managing ingredients within CreatePreparationScreen state
export type EditablePrepIngredient = {
    key: string; // Unique key for lists
    ingredient_id?: string | null; // Keep track of existing ID
    name: string;
    amountStr: string; // Keep original (base) amount as string for TextInput
    unitId: string | null; // Store matched unit ID
    isPreparation?: boolean;
    // Carry over other potentially useful fields from ParsedIngredient if needed
    unit?: string | null; // Original unit string for reference
    item?: string | null; // Item description
    matched?: boolean; // Flag to indicate ingredient was auto-matched
};

export type MeasureKind = 'weight' | 'volume' | 'count';

export interface ComponentInput {
  key: string;
  ingredient_id: string;
  name: string;
  amount: string;
  unit_id: string | null;
  isPreparation: boolean;
  item?: string | null;

  // --- Fields for when isPreparation is true ---
  originalPrep?: Preparation | null | undefined;

  subIngredients?: ParsedIngredient[] | null;
  matched?: boolean;
  prepStateEditableIngredients?: EditablePrepIngredient[] | null;
  prepStatePrepUnitId?: string | null;
  prepStateInstructions?: string[] | null;
  prepStateIsDirty?: boolean;
  // Added for synchronization between preparation screens
  prepScaleMultiplier?: number;
  // Base yield metadata for preparations
  prepYield?: number | null;
  prepYieldUnitId?: string | null;
}

export interface IUser {
  user_id: string;
  user_fullname: string | null;
  user_language: ILanguage['ISO_Code'] | null;
  user_email: string | null;
}

export interface ILanguage {
  ISO_Code: 'EN' | 'ES' | 'FR' | 'IT';
  name_english: 'English' | 'Spanish' | 'French' | 'Italian';
  name_in_language: 'English' | 'Español' | 'Français' | 'Italiano';
}