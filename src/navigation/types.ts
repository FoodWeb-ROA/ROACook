import { Recipe, Preparation } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  RecipeDetails: { recipeId: number };
  PreparationDetails: { preparationId: number; recipeServingScale: number };
  CategoryRecipes: { categoryId: number; categoryName: string };
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