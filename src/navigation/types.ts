import { Recipe } from '../types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  RecipeDetails: { recipe: Recipe };
  CategoryRecipes: { categoryId: string; categoryName: string };
};

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Search: undefined;
  Settings: undefined;
};