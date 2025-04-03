import { Recipe, Preparation } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  RecipeDetails: { recipeId: string };
  PreparationDetails: { preparationId: string; recipeServingScale: number };
  CategoryRecipes: { categoryId: string; categoryName: string };
  Settings: undefined;
  Categories: undefined;
  Search: undefined;
};

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Search: undefined;
  Settings: undefined;
};