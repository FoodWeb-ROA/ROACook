import { Recipe, Preparation } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  RecipeDetails: { recipe: Recipe };
  PreparationDetails: { preparation: Preparation; recipeServingScale: number };
  CategoryRecipes: { categoryId: string; categoryName: string };
};

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Search: undefined;
  Settings: undefined;
};