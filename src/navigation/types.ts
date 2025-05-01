import { NavigatorScreenParams } from '@react-navigation/native';
import { ParsedRecipe, ParsedIngredient, Kitchen, EditablePrepIngredient } from '../types';
import { DrawerParamList } from './AppNavigator';

// Define the callback type CreatePreparationScreen will use
export type OnUpdatePrepAmountCallback = (prepKey: string, updatedState: {
  editableIngredients: EditablePrepIngredient[];
  prepUnitId: string | null;
  instructions: string[];
  isDirty: boolean;
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
    preparation: ParsedIngredient;
    scaleMultiplier?: number;
    prepKey?: string; // Key of the component in the parent screen's state
    onUpdatePrepAmount?: OnUpdatePrepAmountCallback; // Callback function
    // --- Initial State Params ---
    initialEditableIngredients?: EditablePrepIngredient[] | null;
    initialPrepUnitId?: string | null;
    initialInstructions?: string[] | null;
    // --- ADDED: Specific amount used in parent dish ---
    dishComponentScaledAmount?: number | null; // The actual amount used in the parent recipe
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