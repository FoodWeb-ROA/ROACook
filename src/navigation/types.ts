import { Recipe, Preparation } from '../types';
import { DrawerParamList } from './AppNavigator';

export type RootStackParamList = {
  CategoryRecipes: { categoryId: string, categoryName: string };
  RecipeDetails: { recipeId: string };
  PreparationDetails: { preparationId: string, recipeServingScale: number };
  CreateRecipe: undefined;
  Login: undefined;
  MainDrawer: { screen: keyof DrawerParamList };
};