import { NavigatorScreenParams } from '@react-navigation/native';
import { ParsedRecipe, ParsedIngredient, Kitchen, EditablePrepIngredient, ComponentInput } from '../types';
import { DrawerParamList } from './AppNavigator';
import { Ingredient, Unit, Preparation } from '../types';

// Define the callback type CreatePreparationScreen will use
export type OnUpdatePrepAmountCallback = (prepKey: string, updatedState: {
  editableIngredients: EditablePrepIngredient[];
  prepUnitId: string | null;
  instructions: string[];
  isDirty: boolean;
}) => void;

// ADDED: Define callback type for new preparation creation
export type OnNewPreparationCreatedCallback = (newPrepData: { 
  id: string; 
  name: string; 
  yieldAmount?: number | null; 
  yieldUnitId?: string | null 
}) => void;

export type RootStackParamList = {
  Login: undefined;
  AppTabs: undefined; // Represents the bottom tab navigator
  Home: undefined;
  AllRecipes: undefined;
  Categories: undefined;
  Search: undefined;
  // Rename RecipeDetails to DishDetails and update param
  DishDetails: { dishId: string };
  CategoryRecipes: { categoryId: string; categoryName: string };
  PreparationDetails: {
    preparationId: string;
    recipeServingScale?: number;
    prepAmountInDish?: number | null;
  };
  CreatePreparation: {
    preparation: ParsedIngredient | Preparation; // Corrected type usage
    scaleMultiplier?: number;
    prepKey?: string; // Key for updating within parent list
    onUpdatePrepAmount?: OnUpdatePrepAmountCallback; // Callback to update parent state
    // --- Initial State Params ---
    initialEditableIngredients?: EditablePrepIngredient[] | null;
    initialPrepUnitId?: string | null;
    initialInstructions?: string[] | null;
    // --- ADDED: Specific amount used in parent dish ---
    dishComponentScaledAmount?: number | null; // The actual amount used in the parent recipe
    onNewPreparationCreated?: OnNewPreparationCreatedCallback; // ADDED: Callback for new prep creation
  };
  Account: undefined;
  Preferences: undefined;
  Support: undefined;
  HelpScreen: undefined;
  MainDrawer: { screen: keyof DrawerParamList };
  CreateRecipe: { 
    dishId?: string; 
    preparationId?: string; 
    parsedRecipe?: ParsedRecipe;
    duplicates?: {
      dish: any[];
      ingredients: Record<string, any[]>;
    } | null;
    useDuplicates?: boolean;
    scaleMultiplier?: number;
    initialComponents?: ComponentInput[];
  } | undefined;
  Inventory: undefined;
  ManageKitchens: undefined;
  RecipeDetail: { recipe: ParsedRecipe };
  EditRecipe: { recipe: ParsedRecipe | null };
  About: undefined;
  RecipeList: undefined;
  Settings: undefined;
};

// Ensure no duplicate DrawerParamList export/declaration exists below