import { Recipe, Preparation } from '../types';

export type RootStackParamList = {
  Home: undefined;
  CategoryRecipes: { categoryId: string, categoryName: string };
  RecipeDetails: { recipeId: string };
  PreparationDetails: { preparationId: string, recipeServingScale: number };
  Search: undefined;
  Settings: undefined;
  Login: undefined;
  Main: undefined;
  Categories: undefined;
};

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Search: undefined;
  Settings: undefined;
};