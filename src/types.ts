export type Dish = {
  dish_id: string;
  dish_name: string;
  menu_section: MenuSection;
  directions: string | null;
  total_time: string | null;
  serving_size: number | null;
  serving_unit: Unit | null;
  cooking_notes: string | null;
  components: DishComponent[];
  isDeleted?: boolean;
  imageUrl?: string;
};

export type DishComponent = {
  dish_id: string;
  ingredient_id: string;
  name: string;
  amount: number;
  unit: Unit;
  isPreparation: boolean;
  preparationDetails: (Preparation & { ingredients: PreparationIngredient[] }) | null;
  rawIngredientDetails: (Ingredient & { base_unit: Unit | null }) | null;
};

export type Preparation = {
  preparation_id: string;
  name: string;
  directions: string | null;
  total_time: number | null;
  yield_unit: Unit | null;
  cooking_notes: string | null;
  ingredients: PreparationIngredient[];
};

export type PreparationIngredient = {
  preparation_id: string;
  ingredient_id: string;
  name: string;
  amount: number;
  unit: Unit;
};

export type Ingredient = {
  ingredient_id: string;
  name: string;
  cooking_notes: string | null;
  storage_location: string | null;
};

export type Unit = {
  unit_id: string;
  unit_name: string;
  system: string | null;
  abbreviation: string | null;
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