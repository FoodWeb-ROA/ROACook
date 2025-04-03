export type Recipe = {
  recipe_id: string;
  recipe_name: string;
  menu_section_id: string;
  directions: string;
  prep_time: string;
  total_time: string;
  rest_time: string;
  servings: string;
  cooking_notes: string;
  ingredients?: RecipeIngredient[];
  preparations?: RecipePreparation[];
  isDeleted?: boolean;
};

export type RecipeIngredient = {
  recipe_id: string;
  ingredient_id: string;
  ingredient: Ingredient;
  amount: number;
  unit_id: string;
  unit: Unit;
};

export type RecipePreparation = {
  recipe_id: string;
  preparation_id: string;
  preparation: Preparation;
  amount: number;
  unit_id: string;
  unit: Unit;
};

export type Preparation = {
  preparation_id: string;
  preparation_name: string;
  directions: string;
  prep_time: string;
  total_time: string;
  rest_time: string;
  servings: string;
  cooking_notes: string;
  ingredients?: PreparationIngredient[];
};

export type PreparationIngredient = {
  preparation_id: string;
  ingredient_id: string;
  ingredient: Ingredient;
  amount: number;
  unit_id: string;
  unit: Unit;
};

export type Ingredient = {
  ingredient_id: string;
  name: string;
};

export type Unit = {
  unit_id: string;
  unit_name: string;
  system: string;
};

export type MenuSection = {
  menu_section_id: string;
  name: string;
};

export type Kitchen = {
  kitchen_id: string;
  name: string;
  location: string;
  members?: KitchenMember[];
};

export type KitchenMember = {
  kitchen_id: string;
  user_id: string;
  role: string;
};

export type User = {
  id: number;
  uuid: string;
  username: string;
  email: string;
  user_type_id: number;
  created_at: string;
  updated_at: string;
};

export type UserType = {
  id: number;
  name: string;
};

export type Category = {
  menu_section_id: string;
  name: string;
  icon: string;
};

export type MeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'cup' | 'oz' | 'lb' | 'count';