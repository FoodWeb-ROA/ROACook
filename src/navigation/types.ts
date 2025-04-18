import { Category, Preparation, Dish, MenuSection, Unit, Ingredient } from '../types';
import { DrawerParamList } from './AppNavigator';

export type RootStackParamList = {
  Login: undefined;
  AppTabs: undefined; // Represents the bottom tab navigator
  Home: undefined;
  Categories: undefined;
  Search: undefined;
  // Rename RecipeDetails to DishDetails and update param
  DishDetails: { dishId: string };
  CategoryRecipes: { categoryId: string; categoryName: string };
  PreparationDetails: { preparationId: string, recipeServingScale?: number };
  Account: undefined;
  Preferences: undefined;
  Support: undefined;
  MainDrawer: { screen: keyof DrawerParamList };
  CreateDish: undefined;
};