import { Category, Preparation, Dish, MenuSection, Unit, Ingredient, ParsedRecipe, ParsedIngredient } from '../types';
import { DrawerParamList } from './AppNavigator';

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
  PreparationDetails: { preparationId: string, recipeServingScale?: number };
  CreatePreparation: { preparation: ParsedIngredient; scaleMultiplier?: number };
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
};

// Ensure no duplicate DrawerParamList export/declaration exists below